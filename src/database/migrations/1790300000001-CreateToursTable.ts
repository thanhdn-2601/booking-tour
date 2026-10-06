import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateToursTable1790300000001 implements MigrationInterface {
  name = 'CreateToursTable1790300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tours" (
        "id" SERIAL NOT NULL,
        "category_id" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tours_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tours_category_id" FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tours_category_id" ON "tours" ("category_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tours"`);
  }
}
