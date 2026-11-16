// 播放器配置管理API
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { queryFirst, execute, parseJsonColumn } from '@/lib/d1';
import { requireAdminRequest } from '@/lib/admin-route';

export interface PlayerConfig {
  mode: 'iframe' | 'local' | 'auto'; // 播放器模式
  enableProxy: boolean; // 是否启用代理
  iframePlayers: IframePlayer[]; // iframe播放器列表
  localPlayerSettings: LocalPlayerSettings; // 本地播放器设置
}

export interface IframePlayer {
  id: string;
  name: string;
  url: string;
  priority: number;
  timeout: number;
  enabled: boolean;
}

export interface LocalPlayerSettings {
  autoSaveProgress: boolean; // 自动保存进度
  progressSaveInterval: number; // 进度保存间隔（秒）
  theme: string; // 主题颜色
}

// 默认配置
const DEFAULT_CONFIG: PlayerConfig = {
  mode: 'local', // 默认使用本地代理模式
  enableProxy: true,
  iframePlayers: [
    {
      id: 'player1',
      name: 'M1907解析接口',
      url: 'https://im1907.top/?jx=',
      priority: 1,
      timeout: 10000,
      enabled: true,
    },
    {
      id: 'player2',
      name: '虾米解析接口',
      url: 'https://jx.xmflv.com/?url=',
      priority: 2,
      timeout: 10000,
      enabled: true,
    },
    {
      id: 'player3',
      name: '咸鱼解析接口',
      url: 'https://jx.xymp4.cc/?url=',
      priority: 3,
      timeout: 10000,
      enabled: true,
    },
    {
      id: 'player4',
      name: '极速解析接口',
      url: 'https://jx.2s0cn/player/?url=',
      priority: 4,
      timeout: 12000,
      enabled: true,
    },
    {
      id: 'player5',
      name: 'PlayerJY解析接口',
      url: 'https://jx.playerjy.com/?url=',
      priority: 5,
      timeout: 12000,
      enabled: true,
    },
    {
      id: 'player6',
      name: '备用播放器',
      url: 'https://jx.jsonplayer.com/player/?url=',
      priority: 6,
      timeout: 12000,
      enabled: true,
    },
    {
      id: 'player7',
      name: '备用播放器2',
      url: 'https://jx.m3u8.tv/jiexi/?url=',
      priority: 7,
      timeout: 15000,
      enabled: true,
    },
  ],
  localPlayerSettings: {
    autoSaveProgress: true,
    progressSaveInterval: 5,
    theme: '#ef4444',
  },
};

// 获取配置
export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).kerkerker_db;

    // 从数据库获取配置
    const configRow = await queryFirst<{ key: string; value: string }>(
      db,
      "SELECT value FROM player_config WHERE key = 'default'"
    );

    // 如果数据库中没有配置，返回默认配置并保存
    if (!configRow || !configRow.value) {
      await execute(
        db,
        "INSERT OR REPLACE INTO player_config (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ['default', JSON.stringify(DEFAULT_CONFIG)]
      );
      return NextResponse.json({
        code: 200,
        data: DEFAULT_CONFIG,
        msg: '获取配置成功（使用默认配置）',
      });
    }

    // 解析 JSON 配置，并与默认配置合并以确保所有字段都存在
    const storedConfig = parseJsonColumn<Partial<PlayerConfig>>(configRow.value);

    // 如果存储的配置为空或不完整，使用默认配置
    if (!storedConfig || !storedConfig.mode || !storedConfig.iframePlayers) {
      const mergedConfig = { ...DEFAULT_CONFIG, ...storedConfig };
      // 保存完整配置到数据库
      await execute(
        db,
        "INSERT OR REPLACE INTO player_config (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ['default', JSON.stringify(mergedConfig)]
      );
      return NextResponse.json({
        code: 200,
        data: mergedConfig,
        msg: '获取配置成功',
      });
    }

    return NextResponse.json({
      code: 200,
      data: storedConfig,
      msg: '获取配置成功',
    });
  } catch (error) {
    console.error('获取播放器配置失败:', error);
    return NextResponse.json(
      {
        code: 500,
        msg: '获取配置失败',
      },
      { status: 500 }
    );
  }
}

// 更新配置
export async function POST(request: NextRequest) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const config: Partial<PlayerConfig> = await request.json();

    // 验证配置格式
    if (!validateConfig(config)) {
      return NextResponse.json(
        {
          code: 400,
          msg: '配置格式错误',
        },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext();
    const db = (env as any).kerkerker_db;

    // 获取现有配置
    const existingRow = await queryFirst<{ value: string }>(
      db,
      "SELECT value FROM player_config WHERE key = 'default'"
    );

    let existingConfig: PlayerConfig | null = null;
    if (existingRow) {
      existingConfig = parseJsonColumn<PlayerConfig>(existingRow.value);
    }

    // 合并配置
    const mergedConfig: PlayerConfig = {
      ...DEFAULT_CONFIG,
      ...existingConfig,
      ...config,
    };

    // 保存到数据库
    await execute(
      db,
      "INSERT OR REPLACE INTO player_config (key, value, updated_at) VALUES (?, ?, datetime('now'))",
      ['default', JSON.stringify(mergedConfig)]
    );

    return NextResponse.json({
      code: 200,
      data: mergedConfig,
      msg: '配置更新成功',
    });
  } catch (error) {
    console.error('更新播放器配置失败:', error);
    return NextResponse.json(
      {
        code: 500,
        msg: '配置更新失败',
      },
      { status: 500 }
    );
  }
}

function validateConfig(config: Partial<PlayerConfig>): boolean {
  // 验证模式
  if (config.mode && !['iframe', 'local', 'auto'].includes(config.mode)) {
    return false;
  }

  // 验证播放器列表
  if (config.iframePlayers) {
    for (const player of config.iframePlayers) {
      if (!player.id || !player.name || !player.url) {
        return false;
      }
    }
  }

  return true;
}
