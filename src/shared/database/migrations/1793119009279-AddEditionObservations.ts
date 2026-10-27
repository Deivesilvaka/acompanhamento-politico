import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEditionObservations1793119009279 implements MigrationInterface {
  name = 'AddEditionObservations1793119009279';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "edition_observations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "edition_id" uuid NOT NULL, "chamber" character varying(10) NOT NULL, "proposition_label" character varying(40) NOT NULL, "provider" character varying(20) NOT NULL, "model" character varying(100) NOT NULL, "content" text NOT NULL, "sources" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_aec3671fd537eb8befd0c92a1e4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb272e9397abf533a7bfdd64c8" ON "edition_observations"  ("edition_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fb272e9397abf533a7bfdd64c8"`,
    );
    await queryRunner.query(`DROP TABLE "edition_observations"`);
  }
}
