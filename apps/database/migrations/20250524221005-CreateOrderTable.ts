import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";
import { OrderStatus } from "../../order/src/entity/order.entity";

export class CreateOrderTable20250524221005 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "order",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "aliasId",
                        type: "uuid",
                        isUnique: true,
                    },
                    {
                        name: "addressId",
                        type: "int",
                    },
                    {
                        name: "userId",
                        type: "int",
                    },
                    {
                        name: "orderStatus",
                        type: "enum",
                        enum: Object.values(OrderStatus),
                        default: `'${OrderStatus.Pending}'`,
                    },
                    {
                        name: "totalAmount",
                        type: "float",
                    },
                    {
                        name: "deliveryCharge",
                        type: "float",
                        isNullable: true,
                    },
                    {
                        name: "tax",
                        type: "float",
                        isNullable: true,
                    },
                    {
                        name: "createdAt",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updatedAt",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                        onUpdate: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true,
        );

        await queryRunner.createForeignKey(
            "order",
            new TableForeignKey({
                columnNames: ["addressId"],
                referencedColumnNames: ["id"],
                referencedTableName: "address",
                onDelete: "SET NULL", // Or "RESTRICT" or "CASCADE" based on requirements
            }),
        );

        await queryRunner.createForeignKey(
            "order",
            new TableForeignKey({
                columnNames: ["userId"],
                referencedColumnNames: ["id"],
                referencedTableName: "customer",
                onDelete: "SET NULL", // Or "RESTRICT" or "CASCADE"
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("order");
        const addressIdForeignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("addressId") !== -1);
        const userIdForeignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("userId") !== -1);

        if (addressIdForeignKey) {
            await queryRunner.dropForeignKey("order", addressIdForeignKey);
        }
        if (userIdForeignKey) {
            await queryRunner.dropForeignKey("order", userIdForeignKey);
        }
        
        await queryRunner.dropTable("order");
    }
}