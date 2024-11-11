import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhoneNumm1731308779501 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`ALTER TABLE "customer" ADD "phoneNumber" character varying NULL , ADD "countryCode" character varying NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "phoneNumber", DROP COLUMN "countryCode"`);
    }

}
