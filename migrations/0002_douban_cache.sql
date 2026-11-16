-- Migration: Douban cache tables
-- Description: Store scraped Douban rankings and top250 for the site to read

CREATE TABLE IF NOT EXISTS douban_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_douban_cache_fetched ON douban_cache(fetched_at);
