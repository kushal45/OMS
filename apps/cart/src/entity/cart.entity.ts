import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { CartItem } from './cart-item.entity'; // To be created

export enum CartStatus {
  ACTIVE = 'ACTIVE', // Cart is currently in use by the customer
  ABANDONED = 'ABANDONED', // Cart was left by the customer
  ORDERED = 'ORDERED', // Cart has been converted to an order
  SAVED = 'SAVED', // Cart is saved for later by the customer (if this feature exists)
}

@Entity('carts') // Explicitly naming the table
export class Cart {
  @PrimaryGeneratedColumn('uuid') // Using UUID for cart ID
  id: string;

  @Index() // Indexing userId for faster lookups
  @Column({ type: 'uuid' }) // Assuming userId is a UUID from the auth service
  userId: string;

  @Column({
    type: 'enum',
    enum: CartStatus,
    default: CartStatus.ACTIVE,
  })
  status: CartStatus;

  @OneToMany(() => CartItem, (cartItem) => cartItem.cart, { cascade: true, eager: false }) // cascade for operations, eager false for performance
  items: CartItem[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  subTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00, nullable: true })
  discountTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00, nullable: true })
  taxTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  grandTotal: number;

  @Column({ type: 'int', default: 0 })
  totalItems: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date; // For cart expiry logic
}