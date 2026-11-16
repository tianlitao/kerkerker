import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { requireAdminRequest } from '@/lib/admin-route';

/**
 * 数据库状态 API
 * GET /api/database/status
 * 
 * 返回数据库连接状态、延迟、基本信息
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const unauthorizedResponse = requireAdminRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).kerkerker_db;

    // 执行简单查询测试连接
    await db.prepare('SELECT 1 as test').first();

    const latency = Date.now() - startTime;

    // 获取表列表（SQLite 系统表查询）
    const tablesResult = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();

    const tables = (tablesResult.results || []).map((row: any) => row.name);

    return NextResponse.json({
      code: 200,
      data: {
        connected: true,
        latency,
        database: 'kerkerker-db (Cloudflare D1)',
        databaseType: 'D1 (SQLite)',
        tables,
        tableCount: tables.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const latency = Date.now() - startTime;

    return NextResponse.json({
      code: 500,
      data: {
        connected: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
        database: 'kerkerker-db (Cloudflare D1)',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
