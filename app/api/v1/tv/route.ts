import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1Database } from "@/lib/d1";
import type { CloudflareEnv } from "@/lib/d1";
import { TV_CATEGORY_CACHE_KEYS, readCategorySet } from "@/lib/douban-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const db = getD1Database(env as unknown as CloudflareEnv);
    const cached = await readCategorySet(db, TV_CATEGORY_CACHE_KEYS);

    if (cached.missing.length > 0) {
      return NextResponse.json(
        {
          code: 503,
          error: "电视剧分类缓存尚未就绪",
          missing: cached.missing,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      code: 200,
      data: cached.data,
      source: "d1-cache",
      fetched_at: cached.fetchedAt,
    });
  } catch (error) {
    console.error("[Douban TV API Error]", error);
    return NextResponse.json(
      { code: 500, error: "读取电视剧分类缓存失败" },
      { status: 500 }
    );
  }
}
