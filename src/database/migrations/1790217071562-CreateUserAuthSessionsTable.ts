import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAuthSessionsTable1790217071562 implements MigrationInterface {
  name = 'CreateUserAuthSessionsTable1790217071562';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_auth_sessions" (
        "id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "refresh_token_hash" character varying NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_auth_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_auth_sessions_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_auth_sessions_user_id" ON "user_auth_sessions" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_auth_sessions_refresh_token_hash" ON "user_auth_sessions" ("refresh_token_hash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_auth_sessions"`);
  }
}
