import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexToOutboxStatus20250601000200 implements MigrationInterface {
    name = 'AddIndexToOutboxStatus20250601000200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status, created_at);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_outbox_status;`);
    }
}
