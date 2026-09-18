import { DataSource } from 'typeorm';

export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  const tables = dataSource.entityMetadatas.map(
    (meta) => `"${meta.tableName}"`,
  );
  if (!tables.length) return;
  await dataSource.query(
    `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
  );
}
