/**
 * Cloudflare D1 Database Client
 * 
 * Provides database access with TypeScript support for Cloudflare Workers
 */

// D1 Database binding type (will be provided by Cloudflare Workers runtime)
export type D1Database = {
    prepare: (query: string) => D1PreparedStatement;
    dump: () => Promise<ArrayBuffer>;
    batch: <T = unknown>(statements: D1PreparedStatement[]) => Promise<D1Result<T>[]>;
    exec: (query: string) => Promise<D1ExecResult>;
};

export type D1PreparedStatement = {
    bind: (...values: unknown[]) => D1PreparedStatement;
    first: <T = unknown>(colName?: string) => Promise<T | null>;
    run: <T = unknown>() => Promise<D1Result<T>>;
    all: <T = unknown>() => Promise<D1Result<T>>;
    raw: <T = unknown>() => Promise<T[]>;
};

export type D1Result<T = unknown> = {
    results?: T[];
    success: boolean;
    meta: {
        duration: number;
        rows_read: number;
        rows_written: number;
    };
    error?: string;
};

export type D1ExecResult = {
    count: number;
    duration: number;
};

// Environment type with D1 binding
export interface CloudflareEnv {
    DB: D1Database;
    kerkerker_db: D1Database;  // Main D1 database binding
}

/**
 * Get D1 database instance from environment
 * This works in Cloudflare Workers runtime
 */
export function getD1Database(env: CloudflareEnv): D1Database {
    return env.DB || env.kerkerker_db;
}

/**
 * Helper function to execute a query and return first result
 */
export async function queryFirst<T = unknown>(
    db: D1Database,
    query: string,
    params: unknown[] = []
): Promise<T | null> {
    let stmt = db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind(...params);
    }
    return stmt.first<T>();
}

/**
 * Helper function to execute a query and return all results
 */
export async function queryAll<T = unknown>(
    db: D1Database,
    query: string,
    params: unknown[] = []
): Promise<T[]> {
    let stmt = db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind(...params);
    }
    const result = await stmt.all<T>();
    return result.results || [];
}

/**
 * Helper function to execute an INSERT/UPDATE/DELETE query
 */
export async function execute(
    db: D1Database,
    query: string,
    params: unknown[] = []
): Promise<D1Result> {
    let stmt = db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind(...params);
    }
    return stmt.run();
}

/**
 * Helper function to execute multiple statements in a batch
 */
export async function batch(
    db: D1Database,
    statements: Array<{ query: string; params?: unknown[] }>
): Promise<D1Result[]> {
    const preparedStatements = statements.map(({ query, params = [] }) => {
        const stmt = db.prepare(query);
        if (params.length > 0) {
            return stmt.bind(...params);
        }
        return stmt;
    });
    return db.batch(preparedStatements);
}

/**
 * Convert SQLite boolean (0/1) to JavaScript boolean
 */
export function sqliteBoolean(value: number | null | undefined): boolean {
    return value === 1;
}

/**
 * Convert JavaScript boolean to SQLite integer (0/1)
 */
export function toSqliteBoolean(value: boolean | undefined): number {
    return value ? 1 : 0;
}

/**
 * Get current ISO timestamp string for SQLite
 */
export function getCurrentTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Safely parse JSON value stored in SQLite TEXT column
 */
export function parseJsonColumn<T>(value: string | null): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}
