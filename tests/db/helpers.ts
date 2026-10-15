import pg from 'pg';

export const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  member: '00000000-0000-4000-8000-000000000002',
  member3: '00000000-0000-4000-8000-000000000003',
  pending: '00000000-0000-4000-8000-000000000099',
} as const;

const connectionString = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54322/postgres';

export async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

type Who = { kind: 'anon' } | { kind: 'user'; id: string };

/**
 * Runs `fn` inside a transaction as the given API role (anon or a signed-in user),
 * exactly as PostgREST would, then rolls everything back.
 */
export async function as<T>(who: Who, fn: (q: Query) => Promise<T>): Promise<T> {
  return withClient(async (c) => {
    await c.query('begin');
    try {
      if (who.kind === 'anon') {
        await c.query(`set local role anon`);
        await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      } else {
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who.id, role: 'authenticated' })]);
      }
      const q: Query = async (sql, params = []) => (await c.query(sql, params)).rows;
      return await fn(q);
    } finally {
      await c.query('rollback');
    }
  });
}

export type Query = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export const anon: Who = { kind: 'anon' };
export const user = (id: string): Who => ({ kind: 'user', id });
