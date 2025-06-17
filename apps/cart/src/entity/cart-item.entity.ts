import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Cart } from './cart.entity';

@Entity('cart_items') // Explicitly naming the table
@Index(['cart', 'productId'], { unique: true }) // Ensure a product appears only once per cart
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' }) // If cart is deleted, its items are deleted
  @JoinColumn({ name: 'cartId' })
  cart: Cart;

  @Column({ type: 'int' }) // Foreign key to Cart
  cartId: number;

  @Index() // Index productId for potential lookups if needed outside of cart context
  @Column({ type: 'varchar' }) // Assuming productId is a string (e.g., from an external product service)
  productId: number;

  @Column('int')
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 }) // Price of the item at the time it was added
  price: number; // Price per unit

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lineTotal: number; // quantity * price

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Optional: if items can have their own specific data
  // @Column('jsonb', { nullable: true })
  // metadata?: Record<string, any>;
}