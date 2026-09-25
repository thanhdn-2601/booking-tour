import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivationTokenToUsers1790219033049 implements MigrationInterface {
  name = 'AddActivationTokenToUsers1790219033049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "activation_token_hash" character varying,
        ADD COLUMN "activation_token_expires_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_activation_token_hash" ON "users" ("activation_token_hash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_activation_token_hash"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "activation_token_hash",
        DROP COLUMN "activation_token_expires_at"
    `);
  }
}
