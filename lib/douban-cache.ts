import { queryAll, queryFirst } from "@/lib/d1";
import type { D1Database } from "@/lib/d1";

export interface CachedSubject {
  id: string;
  title: string;
  rate: string;
  cover: string;
  url: string;
  episode_info: string;
  cover_x: number;
  cover_y: number;
  playable: boolean;
  is_new: boolean;
}

export interface DoubanCacheRow {
  cache_key: string;
  payload: string;
  item_count: number;
  fetched_at: string;
}

export const HOME_CATEGORY_NAMES = [
  "豆瓣热映",
  "热门电视",
  "国产剧",
  "综艺",
  "美剧",
  "日剧",
  "韩剧",
  "日本动画",
  "纪录片",
];

export const DETAIL_CATEGORY_KEYS = [
  "in_theaters",
  "hot_movies",
  "hot_tv",
  "chinese_tv",
  "variety",
  "us_tv",
  "jp_tv",
  "kr_tv",
  "anime",
  "documentary",
];

/**
 * 首页九宫格使用的分类 -> 分类页 key 的映射。
 * 首页与分类页共用同一份缓存，避免重复抓取同一批豆瓣数据。
 */
export const HOME_NAME_TO_CATEGORY_KEY: Record<string, string> = {
  豆瓣热映: "in_theaters",
  热门电视: "hot_tv",
  国产剧: "chinese_tv",
  综艺: "variety",
  美剧: "us_tv",
  日剧: "jp_tv",
  韩剧: "kr_tv",
  日本动画: "anime",
  纪录片: "documentary",
};

export const HOME_CACHE_KEYS = HOME_CATEGORY_NAMES.map(
  (name) => `category:${HOME_NAME_TO_CATEGORY_KEY[name]}`
);

export const MOVIE_CATEGORY_CACHE_KEYS: Array<[string, string]> = [
  ["热门电影", "hot_movies"],
  ["豆瓣高分", "movies_high_rated"],
  ["动作片", "movies_action"],
  ["喜剧片", "movies_comedy"],
  ["科幻片", "movies_scifi"],
  ["惊悚片", "movies_thriller"],
  ["爱情片", "movies_romance"],
  ["动画电影", "movies_animation"],
];

export const TV_CATEGORY_CACHE_KEYS: Array<[string, string]> = [
  ["热门剧集", "hot_tv"],
  ["国产剧", "chinese_tv"],
  ["美剧", "us_tv"],
  ["日剧", "jp_tv"],
  ["韩剧", "kr_tv"],
  ["英剧", "tv_uk"],
  ["综艺节目", "variety"],
  ["日本动画", "anime"],
];

export const CATEGORY_LIST_LIMIT = 24;

export async function readCache<T>(
  db: D1Database,
  cacheKey: string
): Promise<{ data: T; fetchedAt: string } | null> {
  const row = await queryFirst<DoubanCacheRow>(
    db,
    "SELECT cache_key, payload, item_count, fetched_at FROM douban_cache WHERE cache_key = ?",
    [cacheKey]
  );

  if (!row) return null;

  try {
    return { data: JSON.parse(row.payload) as T, fetchedAt: row.fetched_at };
  } catch {
    return null;
  }
}

export async function readCacheMany(
  db: D1Database,
  cacheKeys: string[]
): Promise<Map<string, { data: CachedSubject[]; fetchedAt: string }>> {
  if (cacheKeys.length === 0) return new Map();

  const placeholders = cacheKeys.map(() => "?").join(",");
  const rows = await queryAll<DoubanCacheRow>(
    db,
    `SELECT cache_key, payload, item_count, fetched_at FROM douban_cache WHERE cache_key IN (${placeholders})`,
    cacheKeys
  );

  const result = new Map<string, { data: CachedSubject[]; fetchedAt: string }>();
  for (const row of rows) {
    try {
      result.set(row.cache_key, {
        data: JSON.parse(row.payload) as CachedSubject[],
        fetchedAt: row.fetched_at,
      });
    } catch {
      // skip malformed entry
    }
  }
  return result;
}

export async function readCategorySet(
  db: D1Database,
  categories: Array<[string, string]>
): Promise<{
  data: Array<{ name: string; data: CachedSubject[] }>;
  fetchedAt: string | null;
  missing: string[];
}> {
  const cacheKeys = categories.map(([, key]) => `category:${key}`);
  const cached = await readCacheMany(db, cacheKeys);
  const missing = categories
    .filter(([, key]) => !cached.has(`category:${key}`))
    .map(([, key]) => key);

  const data = categories.map(([name, key]) => ({
    name,
    data:
      cached
        .get(`category:${key}`)
        ?.data.slice(0, CATEGORY_LIST_LIMIT) ?? [],
  }));
  const fetchedAt = Array.from(cached.values())
    .map((entry) => entry.fetchedAt)
    .sort()
    .pop() ?? null;

  return { data, fetchedAt, missing };
}
