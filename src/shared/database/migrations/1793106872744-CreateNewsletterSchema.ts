import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNewsletterSchema1793106872744 implements MigrationInterface {
  name = 'CreateNewsletterSchema1793106872744';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Busca sem acento ("educacao" encontra "educação").
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(
      `CREATE TYPE "public"."parliamentarians_chamber_enum" AS ENUM('CAMARA', 'SENADO')`,
    );
    await queryRunner.query(
      `CREATE TABLE "parliamentarians" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "chamber" "public"."parliamentarians_chamber_enum" NOT NULL, "external_id" integer NOT NULL, "name" character varying(150) NOT NULL, "party" character varying(30), "state" character(2), "photo_url" character varying(255), CONSTRAINT "PK_112b3e30cc163799f576be912a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f0d83cd7dbfd5bfb1abbca5047" ON "parliamentarians"  ("chamber", "external_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."votes_type_enum" AS ENUM('YES', 'NO', 'ABSTENTION', 'OBSTRUCTION', 'PRESIDING', 'SECRET', 'PRESENT_NOT_VOTING', 'JUSTIFIED_ABSENCE', 'ABSENT', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "votes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "voting_id" uuid NOT NULL, "parliamentarian_id" uuid NOT NULL, "type" "public"."votes_type_enum" NOT NULL, "raw_value" character varying(60), "party_at_vote" character varying(30), "state_at_vote" character(2), CONSTRAINT "PK_f3d9fd4a0af865152c3f59db8ff" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e3bd2c2a09746ce44bb76ab424" ON "votes"  ("parliamentarian_id", "type") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2b533959e184e1d9657d1fe24f" ON "votes"  ("voting_id", "parliamentarian_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."votings_chamber_enum" AS ENUM('CAMARA', 'SENADO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."votings_result_enum" AS ENUM('APPROVED', 'REJECTED', 'UNKNOWN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "votings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "chamber" "public"."votings_chamber_enum" NOT NULL, "external_id" character varying(50) NOT NULL, "date" date NOT NULL, "registered_at" TIMESTAMP WITH TIME ZONE, "proposition_type" character varying(10) NOT NULL, "proposition_label" character varying(40) NOT NULL, "summary" text NOT NULL, "description" text NOT NULL, "result" "public"."votings_result_enum" NOT NULL, "is_secret" boolean NOT NULL DEFAULT false, "source_url" character varying(255) NOT NULL, "yes_count" integer NOT NULL DEFAULT '0', "no_count" integer NOT NULL DEFAULT '0', "abstention_count" integer NOT NULL DEFAULT '0', "absent_count" integer NOT NULL DEFAULT '0', "justified_absence_count" integer NOT NULL DEFAULT '0', "other_count" integer NOT NULL DEFAULT '0', "edition_id" uuid, CONSTRAINT "PK_d44f8534b8c53dd3e68071ad099" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_831144781553c3f72482930255" ON "votings"  ("date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_985593f51bd4c8acf25dcc7ded" ON "votings"  ("edition_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_adc873b1f70820633f1f6f9767" ON "votings"  ("chamber", "external_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscribers_status_enum" AS ENUM('PENDING', 'CONFIRMED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscribers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(254) NOT NULL, "status" "public"."subscribers_status_enum" NOT NULL, "confirmation_token_hash" character(64), "confirmation_expires_at" TIMESTAMP WITH TIME ZONE, "confirmation_sent_at" TIMESTAMP WITH TIME ZONE, "confirmed_at" TIMESTAMP WITH TIME ZONE, "consent_version" character varying(20) NOT NULL, "last_edition_id" uuid, CONSTRAINT "PK_cbe0a7a9256c826f403c0236b67" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1a7163c08f0e57bd1c9821508b" ON "subscribers"  ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a0c2788b703c77330a51254ecd" ON "subscribers"  ("confirmation_token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "newsletter_editions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "period_start" date NOT NULL, "period_end" date NOT NULL, "voting_count" integer NOT NULL, "subject" character varying(255) NOT NULL, "html" text NOT NULL, "text" text NOT NULL, "recipient_count" integer NOT NULL DEFAULT '0', "sent_count" integer NOT NULL DEFAULT '0', "failed_count" integer NOT NULL DEFAULT '0', "started_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_984185d61927d97e606a905d54b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "votes" ADD CONSTRAINT "FK_604da63f25992449480ebea0406" FOREIGN KEY ("voting_id") REFERENCES "votings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "votes" ADD CONSTRAINT "FK_2a2fb6b1de810b6d1d0b4af5bc7" FOREIGN KEY ("parliamentarian_id") REFERENCES "parliamentarians"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "votes" DROP CONSTRAINT "FK_2a2fb6b1de810b6d1d0b4af5bc7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "votes" DROP CONSTRAINT "FK_604da63f25992449480ebea0406"`,
    );
    await queryRunner.query(`DROP TABLE "newsletter_editions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a0c2788b703c77330a51254ecd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1a7163c08f0e57bd1c9821508b"`,
    );
    await queryRunner.query(`DROP TABLE "subscribers"`);
    await queryRunner.query(`DROP TYPE "public"."subscribers_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_adc873b1f70820633f1f6f9767"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_985593f51bd4c8acf25dcc7ded"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_831144781553c3f72482930255"`,
    );
    await queryRunner.query(`DROP TABLE "votings"`);
    await queryRunner.query(`DROP TYPE "public"."votings_result_enum"`);
    await queryRunner.query(`DROP TYPE "public"."votings_chamber_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2b533959e184e1d9657d1fe24f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e3bd2c2a09746ce44bb76ab424"`,
    );
    await queryRunner.query(`DROP TABLE "votes"`);
    await queryRunner.query(`DROP TYPE "public"."votes_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0d83cd7dbfd5bfb1abbca5047"`,
    );
    await queryRunner.query(`DROP TABLE "parliamentarians"`);
    await queryRunner.query(
      `DROP TYPE "public"."parliamentarians_chamber_enum"`,
    );
  }
}
