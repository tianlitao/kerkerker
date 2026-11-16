import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * 数据库连接测试 API
 * POST /api/database/test
 * 
 * 测试 D1 数据库连接
 */
export async function POST() {
  const startTime = Date.now();

  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).kerkerker_db;

    if (!db) {
      return NextResponse.json({
        code: 400,
        data: {
          success: false,
          latency: 0,
          error: 'D1 数据库绑定未配置',
        },
      });
    }

    // 执行简单查询测试连接
    const result = await db.prepare('SELECT 1 as test').first();

    const latency = Date.now() - startTime;

    // 获取表数量
    const tables = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();

    return NextResponse.json({
      code: 200,
      data: {
        success: true,
        latency,
        message: '连接测试成功',
        database: 'Cloudflare D1 (kerkerker-db)',
        tableCount: tables.results?.length || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const latency = Date.now() - startTime;

    return NextResponse.json({
      code: 500,
      data: {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
