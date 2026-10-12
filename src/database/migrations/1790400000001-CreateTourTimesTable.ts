import { MigrationInterface, QueryRunner } from 'typeorm';

// Minimal stub ahead of the Tour Times feature — see TourTime entity.
export class CreateTourTimesTable1790400000001 implements MigrationInterface {
  name = 'CreateTourTimesTable1790400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tour_times" (
        "id" SERIAL NOT NULL,
        "tour_id" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tour_times_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tour_times_tour_id" FOREIGN KEY ("tour_id")
          REFERENCES "tours"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tour_times_tour_id" ON "tour_times" ("tour_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tour_times"`);
  }
}
