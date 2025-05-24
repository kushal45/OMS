import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateCustomerAddressTable20250524221003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "customerAdress", // As per entity name
                columns: [
                    {
                        name: "userId",
                        type: "int",
                        isPrimary: true,
                    },
                    {
                        name: "addressId",
                        type: "int",
                        isPrimary: true,
                    },
                ],
            }),
            true,
        );

        await queryRunner.createForeignKey(
            "customerAdress",
            new TableForeignKey({
                columnNames: ["userId"],
                referencedColumnNames: ["id"],
                referencedTableName: "customer",
                onDelete: "CASCADE",
            }),
        );

        await queryRunner.createForeignKey(
            "customerAdress",
            new TableForeignKey({
                columnNames: ["addressId"],
                referencedColumnNames: ["id"],
                referencedTableName: "address",
                onDelete: "CASCADE",
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys first to avoid errors
        const table = await queryRunner.getTable("customerAdress");
        const userIdForeignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("userId") !== -1);
        const addressIdForeignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("addressId") !== -1);
        
        if (userIdForeignKey) {
            await queryRunner.dropForeignKey("customerAdress", userIdForeignKey);
        }
        if (addressIdForeignKey) {
            await queryRunner.dropForeignKey("customerAdress", addressIdForeignKey);
        }
        
        await queryRunner.dropTable("customerAdress");
    }
}