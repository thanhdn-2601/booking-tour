export interface PostgresEnv {
  DB_HOST?: string;
  DB_PORT?: string;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
}

export function buildPostgresConnectionOptions(env: PostgresEnv) {
  return {
    type: 'postgres' as const,
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };
}
