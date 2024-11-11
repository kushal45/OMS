import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entity/product.entity';

@Injectable()
export class ProductRepository {
  constructor(
    @InjectRepository(Product)
    private readonly repository: Repository<Product>,
  ) {}

  async create(product: Partial<Product>): Promise<Product> {
    const newProduct = this.repository.create(product);
    return this.repository.save(newProduct);
  }

  async findAll(): Promise<Product[]> {
    return this.repository.find();
  }

  async findOne(id: number): Promise<Product> {
    return this.repository.findOne({
        where: { id },
    });
  }

  async update(id: number, product: Partial<Product>): Promise<Product> {
    await this.repository.update(id, product);
    return this.repository.findOne({
        where: { id },
    });
  }

  async delete(id: number): Promise<boolean> {
    const deleteRes=await this.repository.delete(id);
    if(deleteRes.affected>0) return true;
    return false;
  }
}