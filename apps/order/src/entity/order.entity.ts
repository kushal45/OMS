import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Address } from '../../../../libs/address/src/entity/address.entity';
import { Customer } from '../../../auth/src/entity/customer.entity';

export enum OrderStatus {
  Pending = 'Pending',
  Reserved = 'Reserved',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled',
  Shipped = 'Shipped',
  Delivered = 'Delivered',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true })
  aliasId: string;

  @ManyToOne(() => Address,address=>address.id) // Removed eager: true
  @JoinColumn({ name: 'addressId' })
  address: Address;

  @ManyToOne(() => Customer, customer=>customer.id) // Removed eager: true
  @JoinColumn({ name: 'userId' })
  user: Customer;

  @Column("int")
  addressId: number;

  @Column("int")
  userId: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.Pending })
  orderStatus: OrderStatus;

  @Column({ type: 'float' })
  totalAmount: number;

  @Column({ type: 'float', nullable: true })
  deliveryCharge: number;

  @Column({ type: 'float', nullable: true })
  tax: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}