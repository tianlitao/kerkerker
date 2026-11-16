import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DETAIL_CATEGORY_KEYS, readCache } from "@/lib/douban-cache";
import type { CachedSubject } from "@/lib/douban-cache";
import { getD1Database } from "@/lib/d1";
import type { CloudflareEnv } from "@/lib/d1";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10) || 20)
  );

  if (!DETAIL_CATEGORY_KEYS.includes(category)) {
    return NextResponse.json(
      { code: 400, error: `不支持的分类: ${category}` },
      { status: 400 }
    );
  }

  try {
    const { env } = await getCloudflareContext();
    const db = getD1Database(env as unknown as CloudflareEnv);
    const cached = await readCache<CachedSubject[]>(db, `category:${category}`);

    if (!cached) {
      return NextResponse.json(
        { code: 503, error: "该分类缓存尚未就绪" },
        { status: 503 }
      );
    }

    const start = (page - 1) * limit;
    const subjects = cached.data.slice(start, start + limit);
    const total = cached.data.length;

    return NextResponse.json({
      code: 200,
      data: {
        subjects,
        pagination: {
          page,
          limit,
          total,
          hasMore: start + limit < total,
        },
      },
      source: "d1-cache",
      fetched_at: cached.fetchedAt,
    });
  } catch (error) {
    console.error("[Douban Category API Error]", error);
    return NextResponse.json(
      { code: 500, error: "读取分类缓存失败" },
      { status: 500 }
    );
  }
}
