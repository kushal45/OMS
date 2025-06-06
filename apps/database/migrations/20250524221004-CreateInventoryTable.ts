import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";
import { QueryInput } from "../../inventory/src/interfaces/query-input.interface";

export class CreateInventoryTable20250524221004 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "inventory",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
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
                        name: "reservedQuantity",
                        type: "int",
                    },
                    {
                        name: "location",
                        type: "varchar",
                    },
                    {
                        name: "status",
                        type: "enum",
                        enum: Object.values(QueryInput.InventoryStatus), // Use Object.values for enum
                        default: `'${QueryInput.InventoryStatus.IN_STOCK}'`,
                    },
                ],
            }),
            true,
        );

        await queryRunner.createForeignKey(
            "inventory",
            new TableForeignKey({
                columnNames: ["productId"],
                referencedColumnNames: ["id"],
                referencedTableName: "product",
                onDelete: "CASCADE", // Or "SET NULL" or "RESTRICT" depending on your needs
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("inventory");
        const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("productId") !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey("inventory", foreignKey);
        }
        await queryRunner.dropTable("inventory");
    }
}