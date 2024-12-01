import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderItems1732971439033 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "orderItems" ("id" SERIAL NOT NULL, "creationDate" TIMESTAMP NOT NULL DEFAULT now(), "updatedDate" TIMESTAMP NOT NULL DEFAULT now(), "quantity" integer NOT NULL, "orderId" integer, "productId" integer, CONSTRAINT "PK_1d1a4e7c4f8b2d9e9e0e3a9e6b4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "orderItems" ADD CONSTRAINT "FK_4b1b4f3c9b5f1d9d1e0b5d9e3f9" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orderItems" ADD CONSTRAINT "FK_8d1b4f3c9b5f1d9d1e0b5d9e3f9" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orderItems" DROP CONSTRAINT "FK_8d1b4f3c9b5f1d9d1e0b5d9e3f9"`);
    await queryRunner.query(`ALTER TABLE "orderItems" DROP CONSTRAINT "FK_4b1b4f3c9b5f1d9d1e0b5d9e3f9"`);
    await queryRunner.query(`DROP TABLE "orderItems"`);
  }
}
