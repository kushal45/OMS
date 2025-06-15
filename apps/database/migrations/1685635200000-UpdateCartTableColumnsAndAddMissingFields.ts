import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateCartTableColumnsAndAddMissingFields1685635200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename user_id to userId if it exists
    const table = await queryRunner.getTable('carts');
    if (table) {
      const userIdColumn = table.findColumnByName('user_id');
      console.log('userIdColumn in carts table :', userIdColumn);
      if (userIdColumn) {
        await queryRunner.renameColumn('carts', 'user_id', 'userId');
      }
    }

    // Add missing columns if they do not exist
    const columnsToAdd: TableColumn[] = [
      new TableColumn({
        name: 'status',
        type: 'enum',
        enum: ['ACTIVE', 'ABANDONED', 'ORDERED', 'SAVED'],
        default: `'ACTIVE'`,
        isNullable: false,
      }),
      new TableColumn({
        name: 'subTotal',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: '0.00',
        isNullable: false,
      }),
      new TableColumn({
        name: 'discountTotal',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: '0.00',
        isNullable: true,
      }),
      new TableColumn({
        name: 'taxTotal',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: '0.00',
        isNullable: true,
      }),
      new TableColumn({
        name: 'grandTotal',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: '0.00',
        isNullable: false,
      }),
      new TableColumn({
        name: 'totalItems',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
      new TableColumn({
        name: 'expiresAt',
        type: 'timestamp',
        isNullable: true,
      }),
    ];

    for (const col of columnsToAdd) {
      if (!table?.findColumnByName(col.name)) {
        await queryRunner.addColumn('carts', col);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the column name change
    const table = await queryRunner.getTable('carts');
    if (table) {
      const userIdColumn = table.findColumnByName('userId');
      if (userIdColumn) {
        await queryRunner.renameColumn('carts', 'userId', 'user_id');
      }
    }
    // Drop the columns added in up
    const columnNames = [
      'status',
      'subTotal',
      'discountTotal',
      'taxTotal',
      'grandTotal',
      'totalItems',
      'expiresAt',
    ];
    for (const colName of columnNames) {
      if (table?.findColumnByName(colName)) {
        await queryRunner.dropColumn('carts', colName);
      }
    }
  }
}
