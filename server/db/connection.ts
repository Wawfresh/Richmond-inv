import fs from 'node:fs';
import path from 'node:path';
import knex, { type Knex } from 'knex';

let dbInstance: Knex | null = null;

export function isMysqlClient(): boolean {
  const client = (process.env.DB_CLIENT || '').toLowerCase();
  const hasHost = Boolean(process.env.DB_HOST && process.env.DB_HOST.trim().length > 0);
  return hasHost && (client === 'mysql2' || client === 'mysql' || client === '');
}

export function getDb(): Knex {
  if (dbInstance) return dbInstance;

  if (isMysqlClient()) {
    dbInstance = knex({
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        database: process.env.DB_NAME || 'richmond_inv',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        charset: 'utf8mb4',
        timezone: 'Z',
      },
      pool: { min: 0, max: Number(process.env.DB_POOL_MAX || 8) },
    });
  } else {
    const sqlitePath = path.resolve(process.cwd(), process.env.SQLITE_PATH || './storage/richmond_inv_local.sqlite');
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    dbInstance = knex({
      client: 'better-sqlite3',
      connection: {
        filename: sqlitePath,
      },
      useNullAsDefault: true,
      pool: {
        afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
          conn.pragma('foreign_keys = ON');
          conn.pragma('journal_mode = WAL');
          done(null, conn);
        },
      },
    });
  }

  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
}
