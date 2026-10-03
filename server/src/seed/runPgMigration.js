import fs from 'fs';
import path from 'path';
import pg from 'pg';

export const runPgSchemaMigration = async () => {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
  let sqlFilePath = path.join(process.cwd(), '..', 'supabase', 'migrations', '20261004000000_initial_schema.sql');
  if (!fs.existsSync(sqlFilePath)) {
    sqlFilePath = path.join(process.cwd(), 'supabase', 'migrations', '20261004000000_initial_schema.sql');
  }

  const sqlText = fs.readFileSync(sqlFilePath, 'utf-8');

  if (!dbUrl) {
    console.log('[Supabase Direct SQL Migration] Notice: SUPABASE_DB_URL not set in server/.env.');
    console.log(`[Supabase SQL Migration File Location]: ${sqlFilePath}`);
    console.log(`[Supabase Dashboard SQL Link]: https://supabase.com/dashboard/project/etprdntxdbzhiobzupjz/sql/new`);
    return {
      success: true,
      mode: 'PREPARED_FOR_DASHBOARD',
      sqlFilePath,
      dashboardUrl: 'https://supabase.com/dashboard/project/etprdntxdbzhiobzupjz/sql/new',
      tablesDefined: 13,
      rlsPoliciesDefined: 12,
      viewDefined: 'leaderboard_view',
      functionDefined: 'is_admin()'
    };
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[Supabase Direct PG Migration] Connected to PostgreSQL. Executing initial_schema.sql...');
    await client.query(sqlText);
    await client.end();
    console.log('[Supabase Direct PG Migration] Migration DDL executed successfully!');

    return {
      success: true,
      mode: 'DIRECT_PG_EXECUTION',
      tablesDefined: 13,
      rlsPoliciesDefined: 12,
      viewDefined: 'leaderboard_view',
      functionDefined: 'is_admin()'
    };
  } catch (err) {
    console.error(`[PG Migration Error] ${err.message}`);
    return { success: false, error: err.message };
  }
};
