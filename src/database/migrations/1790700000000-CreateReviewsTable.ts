import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviewsTable1790700000000 implements MigrationInterface {
  name = 'CreateReviewsTable1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" SERIAL NOT NULL,
        "booking_id" integer NOT NULL,
        "rating" integer NOT NULL,
        "comment" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "reason" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reviews_booking_id" UNIQUE ("booking_id"),
        CONSTRAINT "FK_reviews_booking_id" FOREIGN KEY ("booking_id")
          REFERENCES "bookings"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reviews"`);
  }
}
