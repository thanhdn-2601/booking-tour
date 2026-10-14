import { MigrationInterface, QueryRunner } from 'typeorm';

// Minimal stub ahead of the Booking feature — see Booking entity.
export class CreateBookingsTable1790500000001 implements MigrationInterface {
  name = 'CreateBookingsTable1790500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" SERIAL NOT NULL,
        "tour_time_id" integer NOT NULL,
        "number_of_slots" integer NOT NULL,
        "status" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bookings_tour_time_id" FOREIGN KEY ("tour_time_id")
          REFERENCES "tour_times"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_tour_time_id" ON "bookings" ("tour_time_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bookings"`);
  }
}
