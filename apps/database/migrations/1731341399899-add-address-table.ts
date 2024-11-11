import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class AddAddressTable1731341399899 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
         * id: pk,
userId?:fk to User,
street:string,
state:string,
city:string,
pincode:Integer,
country
         */
    queryRunner.createTable(
      new Table({
        name: 'address',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'userId', type: 'int', isNullable: false },
          { name: 'street', type: 'varchar', length: '55', isNullable: false },
          { name: 'state', type: 'varchar', length: '55', isNullable: false },
          { name: 'city', type: 'varchar', length: '55', isNullable: false },
          { name: 'pincode', type: 'int', isNullable: false },
          { name: 'country', type: 'varchar', length: '55', isNullable: false },
        ],
      }),
      true,true,true,
    );
    queryRunner.createForeignKey(
      'address',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.dropTable('address', true, true, true);
  }
}
