import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterToursAddColumns1790400000000 implements MigrationInterface {
  name = 'AlterToursAddColumns1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours"
        ADD COLUMN "title" character varying NOT NULL,
        ADD COLUMN "description" character varying NOT NULL,
        ADD COLUMN "status" character varying NOT NULL DEFAULT 'draft'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours"
        DROP COLUMN "status",
        DROP COLUMN "description",
        DROP COLUMN "title"
    `);
  }
}
