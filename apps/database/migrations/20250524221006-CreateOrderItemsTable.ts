import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateOrderItemsTable20250524221006 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "orderItems",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "orderId",
                        type: "int",
                    },
                    {
                        name: "productId",
                        type: "int",
                    },
                    {
                        name: "quantity",
                        type: "int",
                    },
                    {
                        name: "creationDate",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updatedDate",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                        onUpdate: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true,
        );

        await queryRunner.createForeignKey(
            "orderItems",
            new TableForeignKey({
                columnNames: ["orderId"],
                referencedColumnNames: ["id"],
                referencedTableName: "order",
                onDelete: "CASCADE",
            }),
        );

        await queryRunner.createForeignKey(
            "orderItems",
            new TableForeignKey({
                columnNames: ["productId"],
                referencedColumnNames: ["id"],
                referencedTableName: "product",
                onDelete: "CASCADE", // Or "SET NULL" / "RESTRICT"
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("orderItems");
        const orderIdForeignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("orderId") !== -1);
        const productIdForeignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("productId") !== -1);

        if (orderIdForeignKey) {
            await queryRunner.dropForeignKey("orderItems", orderIdForeignKey);
        }
        if (productIdForeignKey) {
            await queryRunner.dropForeignKey("orderItems", productIdForeignKey);
        }

        await queryRunner.dropTable("orderItems");
    }
}