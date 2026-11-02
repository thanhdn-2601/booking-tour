import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetTokenToUsers1790900000000 implements MigrationInterface {
  name = 'AddPasswordResetTokenToUsers1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "password_reset_token_hash" character varying,
        ADD COLUMN "password_reset_token_expires_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_password_reset_token_hash" ON "users" ("password_reset_token_hash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_password_reset_token_hash"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "password_reset_token_hash",
        DROP COLUMN "password_reset_token_expires_at"
    `);
  }
}
