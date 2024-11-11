import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class ChangeSkuLen1731335082266 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.changeColumn(
          'product',
          'sku',
          new TableColumn({
            name: 'sku',
            type: 'varchar',
            length: '20',
            isUnique: true,
            isNullable: false,
          }),
        );
      }
    
      public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.changeColumn(
          'product',
          'sku',
          new TableColumn({
            name: 'sku',
            type: 'varchar',
            length: '3',
            isUnique: true,
            isNullable: false,
          }),
        );
      }

}
