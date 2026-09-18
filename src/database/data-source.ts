import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import { buildPostgresConnectionOptions } from './postgres-connection-options';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

export default new DataSource({
  ...buildPostgresConnectionOptions(process.env),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
