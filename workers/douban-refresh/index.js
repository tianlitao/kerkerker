const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";
const REFERER = "https://movie.douban.com/";
// 豆瓣 j/search_subjects 单次最多可返回 100 条，
// 且与逐页翻取结果完全一致（实测 100 条同序同集合），一次请求即可。
const PAGE_SIZE = 100;
const CATEGORY_PAGES = 1;

// 首页九宫格与分类页共用同一批缓存，首页直接复用下列 key，
// 因此这里只需要抓取一次。
const DETAIL_CATEGORIES = [
  ["in_theaters", "nowplaying", ""],
  ["hot_movies", "movie", "热门"],
  ["hot_tv", "tv", "热门"],
  ["chinese_tv", "tv", "国产剧"],
  ["variety", "tv", "综艺"],
  ["us_tv", "tv", "美剧"],
  ["jp_tv", "tv", "日剧"],
  ["kr_tv", "tv", "韩剧"],
  ["anime", "tv", "日本动画"],
  ["documentary", "tv", "纪录片"],
];

const MOVIE_TV_EXTRA_CATEGORIES = [
  ["movies_high_rated", "movie", "豆瓣高分"],
  ["movies_action", "movie", "动作"],
  ["movies_comedy", "movie", "喜剧"],
  ["movies_scifi", "movie", "科幻"],
  ["movies_thriller", "movie", "惊悚"],
  ["movies_romance", "movie", "爱情"],
  ["movies_animation", "movie", "动画"],
  ["tv_uk", "tv", "英剧"],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 真正的"正在热映"榜单。
 * j/search_subjects 的 movie/热门 是"热门电影"而不是院线在映，
 * 之前两者共用同一数据源导致 in_theaters 与 hot_movies 完全重复。
 * 影院页的服务端渲染里带 data-subject / data-title / data-score，可直接解析。
 */
async function fetchNowPlaying() {
  const response = await fetch(
    "https://movie.douban.com/cinema/nowplaying/beijing/",
    { headers: { "User-Agent": UA, Referer: REFERER } }
  );
  if (!response.ok) {
    throw new Error(`douban nowplaying ${response.status}`);
  }
  const html = await response.text();
  const items = [];
  const blocks = html.split(/<li\s+id="/).slice(1);
  for (const block of blocks) {
    const idMatch = block.match(/^(\d+)"/);
    if (!idMatch) continue;
    // 该页同时列出"即将上映"，只保留真正在映的条目。
    const categoryMatch = block.match(/data-category="([^"]*)"/);
    if (categoryMatch && categoryMatch[1] !== "nowplaying") continue;
    const titleMatch = block.match(/data-title="([^"]*)"/);
    if (!titleMatch) continue;
    const scoreMatch = block.match(/data-score="([^"]*)"/);
    const coverMatch = block.match(/<img\s+src="([^"]+)"/);
    const score = scoreMatch ? scoreMatch[1].trim() : "";
    items.push({
      id: idMatch[1],
      title: titleMatch[1].trim(),
      rate: score === "0" ? "" : score,
      cover: coverMatch ? coverMatch[1] : "",
      url: `https://movie.douban.com/subject/${idMatch[1]}/`,
      episode_info: "",
      cover_x: 0,
      cover_y: 0,
      playable: false,
      is_new: false,
    });
  }
  if (items.length === 0) {
    throw new Error("douban nowplaying: no items parsed");
  }
  return items;
}

async function fetchSubjects(type, tag, start, limit) {
  const url =
    `https://movie.douban.com/j/search_subjects?type=${type}` +
    `&tag=${encodeURIComponent(tag)}&page_limit=${limit}&page_start=${start}`;
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Referer: REFERER },
  });
  if (!response.ok) {
    throw new Error(`douban ${response.status} for ${type}/${tag}@${start}`);
  }
  const data = await response.json();
  return Array.isArray(data.subjects) ? data.subjects : [];
}

function normalize(subject) {
  return {
    id: String(subject.id),
    title: subject.title || "",
    rate: subject.rate || "",
    cover: subject.cover || "",
    url: subject.url || `https://movie.douban.com/subject/${subject.id}/`,
    episode_info: subject.episodes_info || "",
    cover_x: subject.cover_x || 0,
    cover_y: subject.cover_y || 0,
    playable: Boolean(subject.playable),
    is_new: Boolean(subject.is_new),
  };
}

async function fetchTop250() {
  const items = [];
  for (let start = 0; start < 250; start += 25) {
    const response = await fetch(`https://movie.douban.com/top250?start=${start}`, {
      headers: { "User-Agent": UA, Referer: REFERER },
    });
    if (!response.ok) {
      throw new Error(`douban top250 ${response.status} @${start}`);
    }
    const html = await response.text();
    const blocks = html.split('<div class="item">').slice(1);
    for (const block of blocks) {
      const idMatch = block.match(/subject\/(\d+)\//);
      const titleMatch = block.match(/<span class="title">([^<]+)<\/span>/);
      const rateMatch = block.match(/property="v:average">([^<]*)</);
      const coverMatch = block.match(/<img[^>]+src="([^"]+)"/);
      if (!idMatch || !titleMatch) continue;
      items.push({
        id: idMatch[1],
        title: titleMatch[1].trim(),
        rate: rateMatch ? rateMatch[1].trim() : "",
        cover: coverMatch ? coverMatch[1] : "",
        url: `https://movie.douban.com/subject/${idMatch[1]}/`,
        episode_info: "",
        cover_x: 0,
        cover_y: 0,
        playable: false,
        is_new: false,
      });
    }
    await sleep(300);
  }
  return items;
}

async function upsert(db, key, payload, itemCount) {
  await db
    .prepare(
      `INSERT INTO douban_cache (cache_key, payload, item_count, fetched_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(cache_key) DO UPDATE SET
         payload = excluded.payload,
         item_count = excluded.item_count,
         fetched_at = excluded.fetched_at`
    )
    .bind(key, JSON.stringify(payload), itemCount)
    .run();
}

async function refreshCategory(db, key, type, tag, pages, limit) {
  if (type === "nowplaying") {
    const items = await fetchNowPlaying();
    await upsert(db, `category:${key}`, items, items.length);
    return items.length;
  }
  const collected = [];
  for (let page = 0; page < pages; page += 1) {
    const subjects = await fetchSubjects(type, tag, page * limit, limit);
    if (subjects.length === 0) break;
    collected.push(...subjects.map(normalize));
    if (subjects.length < limit) break;
    await sleep(250);
  }
  await upsert(db, `category:${key}`, collected, collected.length);
  return collected.length;
}

const TASKS = [
  ...DETAIL_CATEGORIES.map(([key, type, tag]) => ({
    key,
    type,
    tag,
    pages: CATEGORY_PAGES,
    limit: PAGE_SIZE,
  })),
  ...MOVIE_TV_EXTRA_CATEGORIES.map(([key, type, tag]) => ({
    key,
    type,
    tag,
    pages: 1,
    limit: 24,
  })),
];

async function runBatch(env, keys, includeTop250) {
  const db = env.kerkerker_db;
  const selected = keys.length
    ? TASKS.filter((task) => keys.includes(task.key))
    : TASKS;
  const report = [];

  for (const task of selected) {
    try {
      const count = await refreshCategory(
        db,
        task.key,
        task.type,
        task.tag,
        task.pages,
        task.limit
      );
      report.push({ key: task.key, ok: true, count });
    } catch (error) {
      report.push({ key: task.key, ok: false, error: String(error) });
    }
  }

  if (includeTop250) {
    try {
      const top = await fetchTop250();
      await upsert(db, "top250", top, top.length);
      report.push({ key: "top250", ok: true, count: top.length });
    } catch (error) {
      report.push({ key: "top250", ok: false, error: String(error) });
    }
  }

  return report;
}

const HOME_KEYS = [
  "in_theaters",
  "hot_tv",
  "chinese_tv",
  "variety",
  "us_tv",
  "jp_tv",
  "kr_tv",
  "anime",
  "documentary",
];
const EXTRA_LIST_KEYS = MOVIE_TV_EXTRA_CATEGORIES.map(([key]) => key);

export default {
  async scheduled(event, env, ctx) {
    const hour = new Date(event.scheduledTime).getUTCHours();
    const sequence = Math.floor(hour / 2);
    const extraStart = (sequence * 2) % EXTRA_LIST_KEYS.length;
    const extraKeys = [
      EXTRA_LIST_KEYS[extraStart],
      EXTRA_LIST_KEYS[(extraStart + 1) % EXTRA_LIST_KEYS.length],
    ];
    const keys = [...HOME_KEYS, "hot_movies", ...extraKeys];
    const includeTop250 = sequence % 4 === 0;
    ctx.waitUntil(
      runBatch(env, keys, includeTop250).then((report) => {
        console.log(
          "douban refresh report",
          JSON.stringify({ sequence, keys, top250: includeTop250, report })
        );
      })
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/refresh") {
      return new Response("douban-refresh worker", { status: 200 });
    }
    const keys = (url.searchParams.get("keys") || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    const report = await runBatch(env, keys, keys.includes("top250"));
    const failed = report.filter((item) => !item.ok);
    return new Response(
      JSON.stringify({ report, failed: failed.length }, null, 2),
      {
        status: failed.length === 0 ? 200 : 500,
        headers: { "content-type": "application/json" },
      }
    );
  },
};
