import type { D1Database } from "./d1";
import { queryAll, queryFirst, execute, batch, sqliteBoolean, toSqliteBoolean, getCurrentTimestamp } from "./d1";
import type {
  DailymotionConfigData,
  DailymotionChannelConfig,
} from "@/types/dailymotion-config";

export interface DailymotionChannelRow {
  id: string;
  username: string;
  description?: string | null;
  followers_count: number;
  videos_count: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DailymotionConfigRow {
  id: string; // 'global'
  proxy_enabled: number;
  proxy_url?: string | null;
  created_at: string;
  updated_at: string;
}

// Convert database rows to config object
function rowsToConfig(
  channels: DailymotionChannelRow[],
  config: DailymotionConfigRow | null
): DailymotionConfigData {
  return {
    channels: channels.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.username, // Using username as display name
      avatarUrl: undefined,
      isActive: sqliteBoolean(row.is_active),
      createdAt: row.created_at,
    })),
    defaultChannelId: channels.length > 0 ? channels[0].id : undefined,
  };
}

// Get all Dailymotion configuration
export async function getDailymotionConfigFromDB(db: D1Database): Promise<DailymotionConfigData> {
  try {
    const channels = await queryAll<DailymotionChannelRow>(
      db,
      'SELECT * FROM dailymotion_channels ORDER BY created_at ASC'
    );

    const config = await queryFirst<DailymotionConfigRow>(
      db,
      "SELECT * FROM dailymotion_config WHERE id = 'global'"
    );

    if (channels.length === 0) {
      console.log("⚠️ 数据库中没有 Dailymotion 频道，返回空配置");
      return {
        channels: [],
        defaultChannelId: undefined,
      };
    }

    console.log("✅ 从数据库获取 Dailymotion 配置");
    return rowsToConfig(channels, config);
  } catch (error) {
    console.error("❌ 获取 Dailymotion 配置失败:", error);
    throw error;
  }
}

// Save complete configuration to database
export async function saveDailymotionConfigToDB(
  db: D1Database,
  config: DailymotionConfigData
): Promise<void> {
  try {
    const now = getCurrentTimestamp();

    // Get existing channel IDs
    const existingChannels = await queryAll<{ id: string }>(
      db,
      'SELECT id FROM dailymotion_channels'
    );
    const existingIds = new Set(existingChannels.map((c) => c.id));
    const newIds = new Set(config.channels.map((c) => c.id));

    const statements = [];

    // Delete channels not in new config
    for (const existingId of existingIds) {
      if (!newIds.has(existingId)) {
        statements.push({
          query: 'DELETE FROM dailymotion_channels WHERE id = ?',
          params: [existingId]
        });
      }
    }

    // Insert or update channels
    for (const channel of config.channels) {
      statements.push({
        query: `INSERT INTO dailymotion_channels (
          id, username, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at`,
        params: [
          channel.id,
          channel.username,
          toSqliteBoolean(channel.isActive),
          channel.createdAt,
          now
        ]
      });
    }

    if (statements.length > 0) {
      await batch(db, statements);
    }

    console.log("✅ Dailymotion 配置已保存到数据库");
  } catch (error) {
    console.error("❌ 保存 Dailymotion 配置失败:", error);
    throw error;
  }
}

// Add a new channel
export async function addDailymotionChannelToDB(
  db: D1Database,
  username: string,
  displayName: string,
  avatarUrl?: string
): Promise<DailymotionChannelConfig> {
  try {
    const now = getCurrentTimestamp();
    const id = `channel_${Date.now()}`;

    await execute(
      db,
      `INSERT INTO dailymotion_channels (
        id, username, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [id, username, 1, now, now]
    );

    console.log(`✅ 添加 Dailymotion 频道: ${displayName}`);

    return {
      id,
      username,
      displayName,
      avatarUrl,
      isActive: true,
      createdAt: now,
    };
  } catch (error) {
    console.error(`❌ 添加 Dailymotion 频道失败: ${displayName}`, error);
    throw error;
  }
}

// Update a channel
export async function updateDailymotionChannelInDB(
  db: D1Database,
  id: string,
  updates: Partial<Omit<DailymotionChannelConfig, "id" | "createdAt">>
): Promise<void> {
  try {
    const now = getCurrentTimestamp();
    const setParts: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (updates.username !== undefined) {
      setParts.push('username = ?');
      params.push(updates.username);
    }

    if (updates.isActive !== undefined) {
      setParts.push('is_active = ?');
      params.push(toSqliteBoolean(updates.isActive));
    }

    params.push(id);

    const result = await execute(
      db,
      `UPDATE dailymotion_channels SET ${setParts.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.success) {
      throw new Error(`频道不存在: ${id}`);
    }

    console.log(`✅ 更新 Dailymotion 频道: ${id}`);
  } catch (error) {
    console.error(`❌ 更新 Dailymotion 频道失败: ${id}`, error);
    throw error;
  }
}

// Delete a channel
export async function deleteDailymotionChannelFromDB(
  db: D1Database,
  id: string
): Promise<void> {
  try {
    const result = await execute(
      db,
      'DELETE FROM dailymotion_channels WHERE id = ?',
      [id]
    );

    if (!result.success) {
      throw new Error(`频道不存在: ${id}`);
    }

    console.log(`✅ 删除 Dailymotion 频道: ${id}`);
  } catch (error) {
    console.error(`❌ 删除 Dailymotion 频道失败: ${id}`, error);
    throw error;
  }
}

// Set default channel (placeholder - not fully implemented in D1 schema)
export async function setDefaultDailymotionChannelInDB(
  db: D1Database,
  channelId: string
): Promise<void> {
  try {
    // Verify channel exists
    const channel = await queryFirst<DailymotionChannelRow>(
      db,
      'SELECT * FROM dailymotion_channels WHERE id = ?',
      [channelId]
    );

    if (!channel) {
      throw new Error(`频道不存在: ${channelId}`);
    }

    console.log(`✅ 设置默认 Dailymotion 频道: ${channelId}`);
    // Default channel selection can be handled in application logic
  } catch (error) {
    console.error(`❌ 设置默认 Dailymotion 频道失败: ${channelId}`, error);
    throw error;
  }
}
