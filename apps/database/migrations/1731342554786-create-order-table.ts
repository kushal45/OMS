import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
  } from 'typeorm';

export class CreateOrderTable1731342554786 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        /**
             * id: pk 
    orderStatus: 
    aliasId:UUID,
    addressId: fk of Address table 
    userId: fk to User table
    enum(Pending,Reserved,Confirmed, Cancelled,Shipped,Delivered)
    totalAmount:Float,
    deliveryCharge:,
    tax
    creationD:Date
    updateD:Date
             */
            queryRunner.createTable(new Table({
                name: 'order',
                columns: [
                    {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                    },
                    {
                    name: 'orderStatus',
                    type: 'enum',
                    enum: ['Pending', 'Reserved', 'Confirmed', 'Cancelled', 'Shipped', 'Delivered'],
                    },
                    {
                    name: 'aliasId',
                    type: 'uuid',
                    isUnique: true,
                    },
                    {
                    name: 'addressId',
                    type: 'int',
                    isNullable: false,
                    },
                    {
                    name: 'userId',
                    type: 'int',
                    isNullable: false,
                    },
                    {
                    name: 'totalAmount',
                    type: 'float',
                    isNullable:true,
                    },
                    {
                    name: 'deliveryCharge',
                    type: 'float',
                    isNullable: true,
                    },
                    {
                    name: 'tax',
                    type: 'float',
                    isNullable: true,
                    },
                    {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    },
                    {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    }
                ]
            }), true, true, true);
            /**
             * Add Foreign Key to Address Table
             * Add Foreign Key to User Table
             */
            queryRunner.createForeignKey("order", new TableForeignKey({
                columnNames: ['addressId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'address',
                onDelete: 'CASCADE'
            }));
            queryRunner.createForeignKey("order", new TableForeignKey({
                columnNames: ['userId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'user',
                onDelete: 'CASCADE'
            }));
      }
    
      public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.dropTable('order', true, true, true);
      }

}
