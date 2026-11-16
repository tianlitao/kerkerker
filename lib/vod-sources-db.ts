import { VodSource } from "@/types/drama";
import type { D1Database } from "./d1";
import { queryAll, queryFirst, execute, batch, sqliteBoolean, toSqliteBoolean, getCurrentTimestamp } from "./d1";

export interface VodSourceRow {
  key: string;
  name: string;
  api: string;
  play_url?: string | null;
  use_play_url: number;  // SQLite INTEGER for boolean
  priority: number;
  search_proxy?: string | null;
  parse_proxy?: string | null;
  parse_token?: string | null;
  parse_id?: string | null;
  type: string;
  enabled: number;  // SQLite INTEGER for boolean
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VodSourceSelectionRow {
  id: number;
  selected_key?: string | null;
  updated_at: string;
}

// Convert database row to VodSource type
function rowToVodSource(row: VodSourceRow): VodSource {
  return {
    key: row.key,
    name: row.name,
    api: row.api,
    playUrl: row.play_url || undefined,
    usePlayUrl: sqliteBoolean(row.use_play_url),
    priority: row.priority,
    type: "json",
    searchProxy: row.search_proxy || undefined,
    parseProxy: row.parse_proxy || undefined,
    parseToken: row.parse_token || undefined,
    parseId: row.parse_id || undefined,
  };
}

// Get all enabled VOD sources sorted by priority
export async function getVodSourcesFromDB(db: D1Database): Promise<VodSource[]> {
  const rows = await queryAll<VodSourceRow>(
    db,
    `SELECT * FROM vod_sources 
     WHERE enabled = 1 
     ORDER BY priority ASC, sort_order ASC`
  );
  return rows.map(rowToVodSource);
}

// Get all VOD sources (including disabled)
export async function getAllVodSourcesFromDB(db: D1Database): Promise<VodSourceRow[]> {
  return queryAll<VodSourceRow>(
    db,
    `SELECT * FROM vod_sources 
     ORDER BY priority ASC, sort_order ASC`
  );
}

// Save or update a VOD source
export async function saveVodSourceToDB(
  db: D1Database,
  source: VodSource & { enabled?: boolean; sortOrder?: number }
) {
  const now = getCurrentTimestamp();

  await execute(
    db,
    `INSERT INTO vod_sources (
      key, name, api, play_url, use_play_url, priority,
      search_proxy, parse_proxy, parse_token, parse_id,
      type, enabled, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name,
      api = excluded.api,
      play_url = excluded.play_url,
      use_play_url = excluded.use_play_url,
      priority = excluded.priority,
      search_proxy = excluded.search_proxy,
      parse_proxy = excluded.parse_proxy,
      parse_token = excluded.parse_token,
      parse_id = excluded.parse_id,
      type = excluded.type,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at`,
    [
      source.key,
      source.name,
      source.api,
      source.playUrl || null,
      toSqliteBoolean(source.usePlayUrl ?? true),
      source.priority ?? 0,
      source.searchProxy || null,
      source.parseProxy || null,
      source.parseToken || null,
      source.parseId || null,
      source.type,
      toSqliteBoolean(source.enabled !== undefined ? source.enabled : true),
      source.sortOrder || 0,
      now,
      now
    ]
  );
}

// Batch save VOD sources (replaces all existing sources)
export async function saveVodSourcesToDB(db: D1Database, sources: VodSource[]) {
  const now = getCurrentTimestamp();

  // Build statements for batch operation
  const statements = [
    // First delete all existing sources
    { query: 'DELETE FROM vod_sources' },
    // Then insert all new sources
    ...sources.map((source, index) => ({
      query: `INSERT INTO vod_sources (
        key, name, api, play_url, use_play_url, priority,
        search_proxy, parse_proxy, parse_token, parse_id,
        type, enabled, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        source.key,
        source.name,
        source.api,
        source.playUrl || null,
        toSqliteBoolean(source.usePlayUrl ?? true),
        source.priority ?? index,
        source.searchProxy || null,
        source.parseProxy || null,
        source.parseToken || null,
        source.parseId || null,
        source.type,
        1, // enabled
        index, // sort_order
        now,
        now
      ]
    }))
  ];

  await batch(db, statements);
}

// Delete a VOD source by key
export async function deleteVodSourceFromDB(db: D1Database, key: string) {
  await execute(db, 'DELETE FROM vod_sources WHERE key = ?', [key]);
}

// Toggle source enabled/disabled status
export async function toggleVodSourceEnabled(
  db: D1Database,
  key: string,
  enabled: boolean
) {
  const now = getCurrentTimestamp();
  await execute(
    db,
    'UPDATE vod_sources SET enabled = ?, updated_at = ? WHERE key = ?',
    [toSqliteBoolean(enabled), now, key]
  );
}

// Get selected VOD source
export async function getSelectedVodSourceFromDB(db: D1Database): Promise<VodSource | null> {
  // Get the selected key
  const selection = await queryFirst<VodSourceSelectionRow>(
    db,
    'SELECT selected_key FROM vod_source_selection WHERE id = 1'
  );

  if (selection?.selected_key) {
    // Try to get the selected source if it's enabled
    const row = await queryFirst<VodSourceRow>(
      db,
      'SELECT * FROM vod_sources WHERE key = ? AND enabled = 1',
      [selection.selected_key]
    );
    if (row) {
      return rowToVodSource(row);
    }
  }

  // If no selection or source not found, return first enabled source
  const row = await queryFirst<VodSourceRow>(
    db,
    'SELECT * FROM vod_sources WHERE enabled = 1 ORDER BY sort_order ASC LIMIT 1'
  );

  return row ? rowToVodSource(row) : null;
}

// Save selected VOD source
export async function saveSelectedVodSourceToDB(db: D1Database, key: string) {
  const now = getCurrentTimestamp();
  await execute(
    db,
    `INSERT INTO vod_source_selection (id, selected_key, updated_at) 
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       selected_key = excluded.selected_key,
       updated_at = excluded.updated_at`,
    [key, now]
  );
}
