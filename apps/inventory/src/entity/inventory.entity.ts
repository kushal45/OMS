import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { Product } from '../../../product/src/entity/product.entity';
import { QueryInput } from '../interfaces/query-input.interface';



@Entity()
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar' }) // Changed from int
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  reservedQuantity: number;

  @Column()
  location: string;

  @Column({ type: 'enum', enum: QueryInput.InventoryStatus, default: QueryInput.InventoryStatus.IN_STOCK })
  status: QueryInput.InventoryStatus;
}