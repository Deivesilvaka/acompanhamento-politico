import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryRetry1793107470327 implements MigrationInterface {
  name = 'AddDeliveryRetry1793107470327';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscribers" ADD "failed_edition_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscribers" ADD "failed_attempts" smallint NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscribers" DROP COLUMN "failed_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscribers" DROP COLUMN "failed_edition_id"`,
    );
  }
}
