import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne } from 'typeorm';
import { Product } from '../../../product/src/entity/product.entity';

export enum InventoryStatus {
  IN_STOCK = 'in-stock',
  OUT_OF_STOCK = 'out-of-stock',
}

@Entity()
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Product, { eager: true })
  product: Product;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  reservedQuantity: number;

  @Column()
  location: string;

  @Column({ type: 'enum', enum: InventoryStatus })
  status: InventoryStatus;
}