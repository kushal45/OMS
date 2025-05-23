import { Injectable, PreconditionFailedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  async executeInTransaction<T>(work: (entityManager: EntityManager) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(queryRunner.manager);
      console.log('result', result);
      if(typeof result === 'boolean' && !result) {
        throw new PreconditionFailedException('Transaction failed');
      }
      if(result){
        await queryRunner.commitTransaction();
        return result;
      }
    } catch (error) {
      console.log('error', error);
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw new PreconditionFailedException(error);
    }
  }
}