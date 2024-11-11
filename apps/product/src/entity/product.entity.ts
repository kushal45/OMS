import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: 'varchar', length: 4 })
  sku: string;

  @Column({ type: 'float' })
  price: number;

  @Column()
  attributes: string;
}