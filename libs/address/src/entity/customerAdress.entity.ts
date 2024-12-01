/**
 * CREATE TABLE user_address (
  userId INT,
  addressId INT,
  PRIMARY KEY (userId, addressId),
  CONSTRAINT fk_user FOREIGN KEY (userId) REFERENCES "user" (id) ON DELETE CASCADE,
  CONSTRAINT fk_address FOREIGN KEY (addressId) REFERENCES address (id) ON DELETE CASCADE
  
);

Generate entity table for user_address table
 */

import { Customer } from '../../../../apps/auth/src/entity/customer.entity';
import { Entity, PrimaryColumn, ManyToOne, JoinColumn, ManyToMany } from 'typeorm';
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
