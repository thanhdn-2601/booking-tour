import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingStatusHistoriesTable1790600000001 implements MigrationInterface {
  name = 'CreateBookingStatusHistoriesTable1790600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "booking_status_histories" (
        "id" SERIAL NOT NULL,
        "booking_id" integer NOT NULL,
        "from_status" character varying,
        "to_status" character varying NOT NULL,
        "reason" character varying,
        "actor_type" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_status_histories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_status_histories_booking_id" FOREIGN KEY ("booking_id")
          REFERENCES "bookings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_booking_status_histories_booking_id"
        ON "booking_status_histories" ("booking_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "booking_status_histories"`);
  }
}
