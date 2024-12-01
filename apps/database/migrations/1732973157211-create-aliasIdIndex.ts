import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAliasIdIndex1732973157211 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`CREATE INDEX idx_alias_id ON "order" USING btree ("aliasId");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`DROP INDEX idx_alias_id on "order";`);
    }

}
