import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthIdentitiesTable1790800000000 implements MigrationInterface {
  name = 'CreateAuthIdentitiesTable1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_identities" (
        "id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "provider" character varying NOT NULL,
        "provider_user_id" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_identities_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_identities_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_auth_identities_provider_provider_user_id"
        ON "auth_identities" ("provider", "provider_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_identities_user_id" ON "auth_identities" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth_identities"`);
  }
}
