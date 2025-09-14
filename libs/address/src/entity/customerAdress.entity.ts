import { Customer } from '../../../../apps/auth/src/entity/customer.entity';
import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Address } from './address.entity';

@Entity("customerAdress")
export class CustomerAddress {
  @PrimaryColumn()
  userId: number;

  @PrimaryColumn()
  addressId: number;
  
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  customer: Customer;

  @ManyToOne(() => Address, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addressId' })
  address: Address;

}
