import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateCartsTable20250531120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "carts",
        columns: [
          {
            name: "id",
            type: "serial",
            isPrimary: true,
          },
          {
            name: "user_id",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "now()",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "now()",
          },
        ],
      })
    );
    await queryRunner.query(`CREATE INDEX "IDX_carts_user_id" ON "carts" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("carts", "IDX_carts_user_id");
    await queryRunner.dropTable("carts");
  }
}
