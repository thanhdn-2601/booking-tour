import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTourTimesAddColumns1790500000000 implements MigrationInterface {
  name = 'AlterTourTimesAddColumns1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_times"
        ADD COLUMN "start_date" date NOT NULL,
        ADD COLUMN "end_date" date NOT NULL,
        ADD COLUMN "price" integer NOT NULL,
        ADD COLUMN "max_capacity" integer NOT NULL,
        ADD COLUMN "status" character varying NOT NULL DEFAULT 'open'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_times"
        DROP COLUMN "status",
        DROP COLUMN "max_capacity",
        DROP COLUMN "price",
        DROP COLUMN "end_date",
        DROP COLUMN "start_date"
    `);
  }
}
