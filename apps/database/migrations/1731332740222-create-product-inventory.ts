import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateProductInventory1731332740222 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Product Table
        await queryRunner.createTable(
          new Table({
            name: 'product',
            columns: [
              { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
              { name: 'name', type: 'varchar', isNullable: false },
              { name: 'description', type: 'text', isNullable: true },
              { name: 'sku', type: 'varchar', length: '4', isUnique: true, isNullable: false },
              { name: 'price', type: 'float', isNullable: false },
              { name: 'attributes', type: 'json', isNullable: true },
            ],
          })
        );
    
        // Create Inventory Table
        await queryRunner.createTable(
          new Table({
            name: 'inventory',
            columns: [
              { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
              { name: 'productId', type: 'int', isNullable: false },
              { name: 'quantity', type: 'int', isNullable: false, default: 0 },
              { name: 'reservedQuantity', type: 'int', isNullable: false, default: 0 },
              { name: 'location', type: 'varchar', isNullable: true },
              {
                name: 'status',
                type: 'enum',
                enum: ['in-stock', 'out-of-stock'],
                default: `'in-stock'`,
              },
            ],
          })
        );
    
        // Create Foreign Key from Inventory to Product
        await queryRunner.createForeignKey(
          'inventory',
          new TableForeignKey({
            columnNames: ['productId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'product',
            onDelete: 'CASCADE',
          })
        );
      }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('inventory');
        await queryRunner.dropTable('product');
    }

}
