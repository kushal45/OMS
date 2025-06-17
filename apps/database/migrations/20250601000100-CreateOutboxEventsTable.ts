import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOutboxEventsTable20250601000100 implements MigrationInterface {
    name = 'CreateOutboxEventsTable20250601000100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE outbox_event_status AS ENUM ('PENDING', 'SENT', 'FAILED');
        `);
        await queryRunner.query(`
            CREATE TABLE outbox_events (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(255) NOT NULL,
                payload JSONB NOT NULL,
                status outbox_event_status NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                sent_at TIMESTAMP WITH TIME ZONE,
                error TEXT
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS outbox_events;`);
        await queryRunner.query(`DROP TYPE IF EXISTS outbox_event_status;`);
    }
}
