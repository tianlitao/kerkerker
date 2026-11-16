import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  HOME_CACHE_KEYS,
  HOME_CATEGORY_NAMES,
  HOME_NAME_TO_CATEGORY_KEY,
  readCacheMany,
} from "@/lib/douban-cache";
import { getD1Database } from "@/lib/d1";
import type { CloudflareEnv } from "@/lib/d1";

export const dynamic = "force-dynamic";

const FILTER_KEYS = [
  "type",
  "year",
  "region",
  "genre",
  "sort",
  "page",
  "pageSize",
];

// 首页每行最多展示 15 条，保留 24 条余量即可。
// 缓存里每个分类有 100 条（在映为 71 条），全量下发会让首页响应膨胀 30 倍。
const ITEMS_PER_CATEGORY = 24;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filters = FILTER_KEYS.filter((key) => params.get(key));

  // 筛选请求（/browse/latest 的筛选与分页）没有对应的豆瓣分类榜单缓存，
  // 直接报错而不是静默返回未筛选的结果。客户端会走外站微服务。
  if (filters.length > 0) {
    return NextResponse.json(
      {
        code: 400,
        error: `本接口不支持筛选参数: ${filters.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const { env } = await getCloudflareContext();
    const db = getD1Database(env as unknown as CloudflareEnv);
    const cached = await readCacheMany(db, HOME_CACHE_KEYS);

    const data = HOME_CATEGORY_NAMES.map((name) => ({
      name,
      data:
        cached
          .get(`category:${HOME_NAME_TO_CATEGORY_KEY[name]}`)
          ?.data.slice(0, ITEMS_PER_CATEGORY) ?? [],
    })).filter((category) => category.data.length > 0);

    if (data.length === 0) {
      return NextResponse.json(
        { code: 503, error: "榜单缓存尚未就绪" },
        { status: 503 }
      );
    }

    const newest = Array.from(cached.values())
      .map((entry) => entry.fetchedAt)
      .sort()
      .pop();

    return NextResponse.json({
      code: 200,
      data,
      source: "d1-cache",
      fetched_at: newest ?? null,
      filters: { genre: "", region: "", sort: "recommend", type: "", year: "" },
    });
  } catch (error) {
    console.error("[Douban New API Error]", error);
    return NextResponse.json(
      { code: 500, error: "读取榜单缓存失败" },
      { status: 500 }
    );
  }
}
