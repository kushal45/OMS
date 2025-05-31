import { Injectable, NotFoundException } from '@nestjs/common'; // Import NotFoundException
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
    const product = await this.productRepository.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    // It's good practice to check if product exists before update too
    const existingProduct = await this.productRepository.findOne(id);
    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found, cannot update.`);
    }
    return this.productRepository.update(id, product);
  }

  async deleteProduct(id: number): Promise<boolean> {
    // It's good practice to check if product exists before delete too
    const existingProduct = await this.productRepository.findOne(id);
    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found, cannot delete.`);
    }
    return this.productRepository.delete(id);
  }
}