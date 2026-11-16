import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readCache } from "@/lib/douban-cache";
import type { CachedSubject } from "@/lib/douban-cache";
import { getD1Database } from "@/lib/d1";
import type { CloudflareEnv } from "@/lib/d1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const db = getD1Database(env as unknown as CloudflareEnv);
    const cached = await readCache<CachedSubject[]>(db, "top250");

    if (!cached) {
      return NextResponse.json(
        { code: 503, error: "Top250 缓存尚未就绪" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      code: 200,
      data: { subjects: cached.data, fetched_at: cached.fetchedAt },
      source: "d1-cache",
    });
  } catch (error) {
    console.error("[Douban Top250 API Error]", error);
    return NextResponse.json(
      { code: 500, error: "读取 Top250 缓存失败" },
      { status: 500 }
    );
  }
}
