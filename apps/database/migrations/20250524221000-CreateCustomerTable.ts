import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateCustomerTable20250524221000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "customer",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "name",
                        type: "varchar",
                    },
                    {
                        name: "email",
                        type: "varchar",
                        isUnique: true,
                    },
                    {
                        name: "password",
                        type: "varchar",
                    },
                    {
                        name: "phoneNumber",
                        type: "varchar",
                        isNullable: true,
                    },
                    {
                        name: "countryCode",
                        type: "varchar",
                        isNullable: true,
                    },
                ],
            }),
            true, // Create foreign keys if not specified (none here)
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("customer");
    }
}