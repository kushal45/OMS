import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFkConstraintOnOrderItems1733040503934 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "orderItems"
            ADD CONSTRAINT "fk_order_items_order"
            FOREIGN KEY ("orderId") REFERENCES "order"("id")
            ON DELETE CASCADE;
          `);
      
          await queryRunner.query(`
            ALTER TABLE "orderItems"
            ADD CONSTRAINT "fk_order_items_product"
            FOREIGN KEY ("productId") REFERENCES "product"("id")
            ON DELETE CASCADE;
          `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "orderItems"
            DROP CONSTRAINT "fk_order_items_order";
          `);
      
          await queryRunner.query(`
            ALTER TABLE "orderItems"
            DROP CONSTRAINT "fk_order_items_product";
          `);
    }

}
