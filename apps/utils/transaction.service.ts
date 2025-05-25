import { Injectable, PreconditionFailedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  async executeInTransaction<T>(
    work: (entityManager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(queryRunner.manager);

      // If the work function explicitly returns boolean `false`,
      // treat it as a signal for a controlled rollback.
      if (typeof result === 'boolean' && result === false) {
        // console.warn('[TransactionService] Work function returned false, initiating rollback.'); // Consider injecting LoggerService
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        // Throw a specific exception to indicate controlled rollback.
        // This ensures the caller knows the transaction did not commit due to business logic.
        throw new PreconditionFailedException(
          'Transaction rolled back by business logic (work function returned false).',
        );
      }

      // If no error was thrown and result wasn't `false`, commit the transaction.
      await queryRunner.commitTransaction();
      return result; // Return the actual result of the work
    } catch (error) {
      // console.error('[TransactionService] Error during transaction, initiating rollback.', error); // Consider injecting LoggerService
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error; // Re-throw the original error (could be from work() or the 'result === false' path)
    } finally {
      // Always release the query runner if it hasn't been released yet.
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }
}