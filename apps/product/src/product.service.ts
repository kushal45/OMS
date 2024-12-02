import { Injectable } from '@nestjs/common';
import { ProductRepository } from './repository/product.repository';
import { Product } from './entity/product.entity';

@Injectable()
export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async createProduct(product: Partial<Product>): Promise<Product> {
    return this.productRepository.create(product);
  }

  async getProducts(): Promise<Product[]> {
    return this.productRepository.findAll();
  }

  async getProductById(id: number): Promise<Product> {
    return this.productRepository.findOne(id);
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    return this.productRepository.update(id, product);
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.productRepository.delete(id);
  }
}