import { ShortDramaSource } from "@/types/shorts-source";
import type { D1Database } from "./d1";
import { queryAll, queryFirst, execute, batch, toSqliteBoolean, getCurrentTimestamp } from "./d1";

export interface ShortDramaSourceRow {
  key: string;
  name: string;
  api: string;
  type_id?: number | null;
  priority: number;
  enabled: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShortDramaSourceSelectionRow {
  id: number;
  selected_key?: string | null;
  updated_at: string;
}

// Convert database row to ShortDramaSource type
function rowToShortDramaSource(row: ShortDramaSourceRow): ShortDramaSource {
  return {
    key: row.key,
    name: row.name,
    api: row.api,
    typeId: row.type_id || undefined,
    priority: row.priority,
  };
}

// Get all enabled shorts sources sorted by priority
export async function getShortsSourcesFromDB(db: D1Database): Promise<ShortDramaSource[]> {
  const rows = await queryAll<ShortDramaSourceRow>(
    db,
    `SELECT * FROM shorts_sources 
     WHERE enabled = 1 
     ORDER BY priority ASC, sort_order ASC`
  );
  return rows.map(rowToShortDramaSource);
}

// Get all shorts sources (including disabled)
export async function getAllShortsSourcesFromDB(db: D1Database): Promise<ShortDramaSourceRow[]> {
  return queryAll<ShortDramaSourceRow>(
    db,
    `SELECT * FROM shorts_sources 
     ORDER BY priority ASC, sort_order ASC`
  );
}

// Batch save shorts sources (replaces all existing sources)
export async function saveShortsSourcesToDB(db: D1Database, sources: ShortDramaSource[]) {
  const now = getCurrentTimestamp();

  const statements = [
    { query: 'DELETE FROM shorts_sources', params: [] },
    ...sources.map((source, index) => ({
      query: `INSERT INTO shorts_sources (
        key, name, api, play_url, use_play_url, priority,
        search_proxy, parse_proxy, parse_token, parse_id,
        type, enabled, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        source.key,
        source.name,
        source.api,
        null, // play_url
        1,    // use_play_url
        source.priority ?? index,
        null, // search_proxy
        null, // parse_proxy
        null, // parse_token
        null, // parse_id
        'json', // type
        1,    // enabled
        index, // sort_order
        now,
        now
      ]
    }))
  ];

  await batch(db, statements);
}

// Delete a shorts source by key
export async function deleteShortsSourceFromDB(db: D1Database, key: string) {
  await execute(db, 'DELETE FROM shorts_sources WHERE key = ?', [key]);
}

// Get selected shorts source
export async function getSelectedShortsSourceFromDB(db: D1Database): Promise<ShortDramaSource | null> {
  const selection = await queryFirst<ShortDramaSourceSelectionRow>(
    db,
    'SELECT selected_key FROM shorts_source_selection WHERE id = 1'
  );

  if (selection?.selected_key) {
    const row = await queryFirst<ShortDramaSourceRow>(
      db,
      'SELECT * FROM shorts_sources WHERE key = ? AND enabled = 1',
      [selection.selected_key]
    );
    if (row) {
      return rowToShortDramaSource(row);
    }
  }

  // If no selection or source not found, return first enabled source
  const row = await queryFirst<ShortDramaSourceRow>(
    db,
    'SELECT * FROM shorts_sources WHERE enabled = 1 ORDER BY sort_order ASC LIMIT 1'
  );

  return row ? rowToShortDramaSource(row) : null;
}

// Get shorts source by key
export async function getShortsSourceByKey(db: D1Database, key: string): Promise<ShortDramaSource | null> {
  const row = await queryFirst<ShortDramaSourceRow>(
    db,
    'SELECT * FROM shorts_sources WHERE key = ? AND enabled = 1',
    [key]
  );

  return row ? rowToShortDramaSource(row) : null;
}

// Save selected shorts source
export async function saveSelectedShortsSourceToDB(db: D1Database, key: string) {
  const now = getCurrentTimestamp();
  await execute(
    db,
    `INSERT INTO shorts_source_selection (id, selected_key, updated_at) 
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       selected_key = excluded.selected_key,
       updated_at = excluded.updated_at`,
    [key, now]
  );
}
