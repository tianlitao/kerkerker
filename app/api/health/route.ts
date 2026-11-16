import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * 健康检查 API
 * GET /api/health
 * 
 * 用于 Docker 容器健康检查和监控
 */
export async function GET() {
  const status: {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    services: {
      api: 'ok';
      database?: 'ok' | 'error';
    };
    errors?: string[];
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ok'
    }
  };

  const errors: string[] = [];

  // 检查 D1 数据库连接
  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).kerkerker_db;

    // 简单查询测试数据库连接
    await db.prepare('SELECT 1 as test').first();
    status.services.database = 'ok';
  } catch (error) {
    status.services.database = 'error';
    errors.push(`D1 Database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 设置总体状态
  if (errors.length > 0) {
    status.status = 'degraded';
    status.errors = errors;
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;

  return NextResponse.json(status, { status: httpStatus });
}
