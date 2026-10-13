import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTourImagesTable1790500000002 implements MigrationInterface {
  name = 'CreateTourImagesTable1790500000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tour_images" (
        "id" SERIAL NOT NULL,
        "tour_id" integer NOT NULL,
        "image_url" character varying NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tour_images_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tour_images_tour_id" FOREIGN KEY ("tour_id")
          REFERENCES "tours"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tour_images_tour_id" ON "tour_images" ("tour_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tour_images"`);
  }
}
