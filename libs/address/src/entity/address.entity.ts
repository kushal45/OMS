import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity("address")
export class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable: true})
  street: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column()
  country: string;

  @Column()
  pincode: string;
}