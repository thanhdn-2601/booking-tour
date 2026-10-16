import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterBookingsAddColumns1790600000000 implements MigrationInterface {
  name = 'AlterBookingsAddColumns1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "user_id" integer NOT NULL,
        ADD COLUMN "total_price" integer NOT NULL,
        ADD CONSTRAINT "FK_bookings_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_user_id" ON "bookings" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "FK_bookings_user_id",
        DROP COLUMN "total_price",
        DROP COLUMN "user_id"
    `);
  }
}
