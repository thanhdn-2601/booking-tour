import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1790217071561 implements MigrationInterface {
  name = 'CreateUsersTable1790217071561';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying,
        "full_name" character varying NOT NULL,
        "phone" character varying,
        "role" character varying NOT NULL DEFAULT 'user',
        "status" character varying NOT NULL DEFAULT 'inactive',
        "email_verified_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
