-- Migration: Initialize database schema for kerkerker
-- Created: 2026-01-16
-- Description: Create all tables for VOD sources, shorts sources, dailymotion config, and player config

-- VOD Sources table
CREATE TABLE IF NOT EXISTS vod_sources (
  key TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  api TEXT NOT NULL,
  play_url TEXT,
  use_play_url INTEGER DEFAULT 1,  -- SQLite uses INTEGER for boolean: 0=false, 1=true
  priority INTEGER DEFAULT 0,
  search_proxy TEXT,
  parse_proxy TEXT,
  parse_token TEXT,
  parse_id TEXT,
  type TEXT DEFAULT 'json' NOT NULL,
  enabled INTEGER DEFAULT 1 NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vod_sources_enabled ON vod_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_vod_sources_priority ON vod_sources(priority, sort_order);

-- VOD Source Selection table
CREATE TABLE IF NOT EXISTS vod_source_selection (
  id INTEGER PRIMARY KEY CHECK(id = 1),  -- Ensure only one row
  selected_key TEXT,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (selected_key) REFERENCES vod_sources(key) ON DELETE SET NULL
);

-- Shorts Sources table
CREATE TABLE IF NOT EXISTS shorts_sources (
  key TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  api TEXT NOT NULL,
  play_url TEXT,
  use_play_url INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  search_proxy TEXT,
  parse_proxy TEXT,
  parse_token TEXT,
  parse_id TEXT,
  type TEXT DEFAULT 'json' NOT NULL,
  enabled INTEGER DEFAULT 1 NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shorts_sources_enabled ON shorts_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_shorts_sources_priority ON shorts_sources(priority, sort_order);

-- Shorts Source Selection table
CREATE TABLE IF NOT EXISTS shorts_source_selection (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  selected_key TEXT,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (selected_key) REFERENCES shorts_sources(key) ON DELETE SET NULL
);

-- Dailymotion Channels table
CREATE TABLE IF NOT EXISTS dailymotion_channels (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  description TEXT,
  followers_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dailymotion_channels_username ON dailymotion_channels(username);
CREATE INDEX IF NOT EXISTS idx_dailymotion_channels_active ON dailymotion_channels(is_active);

-- Dailymotion Config table
CREATE TABLE IF NOT EXISTS dailymotion_config (
  id TEXT PRIMARY KEY CHECK(id = 'global'),  -- Ensure only one config row
  proxy_enabled INTEGER DEFAULT 0 NOT NULL,
  proxy_url TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Player Config table
CREATE TABLE IF NOT EXISTS player_config (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,  -- Store JSON as TEXT
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Insert default player config if not exists
INSERT OR IGNORE INTO player_config (key, value, created_at, updated_at) VALUES 
  ('default', '{}', datetime('now'), datetime('now'));

-- Insert default vod_source_selection if not exists
INSERT OR IGNORE INTO vod_source_selection (id, selected_key, updated_at) VALUES 
  (1, NULL, datetime('now'));

-- Insert default shorts_source_selection if not exists
INSERT OR IGNORE INTO shorts_source_selection (id, selected_key, updated_at) VALUES 
  (1, NULL, datetime('now'));

-- Insert default dailymotion_config if not exists
INSERT OR IGNORE INTO dailymotion_config (id, proxy_enabled, proxy_url, created_at, updated_at) VALUES 
  ('global', 0, NULL, datetime('now'), datetime('now'));
