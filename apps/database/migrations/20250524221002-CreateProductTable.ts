import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateProductTable20250524221002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "product",
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
                        name: "description",
                        type: "varchar", // Assuming varchar, adjust if it's text
                    },
                    {
                        name: "sku",
                        type: "varchar",
                        length: "20", // As per entity definition
                    },
                    {
                        name: "price",
                        type: "float",
                    },
                    {
                        name: "attributes",
                        type: "varchar", // Assuming varchar, adjust if it's JSON or text
                    },
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("product");
    }
}