import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { ProductService } from '../product.service';
import { Product } from './product.type';
import { ProductFilterInput, ProductSortInput } from './product.input';
import { Logger } from '@nestjs/common';

@Resolver(() => Product)
export class ProductResolver {
  private readonly logger = new Logger(ProductResolver.name);

  constructor(private readonly productService: ProductService) {}

  @Query(() => [Product])
  async products(
    @Args('filter', { nullable: true }) filter?: ProductFilterInput,
    @Args('sort', { nullable: true }) sort?: ProductSortInput,
  ): Promise<Product[]> {
    try {
      // Get base products
      let products = await this.productService.getProducts();
      
      // Apply filters
      if (filter) {
        if (filter.name) {
          products = products.filter(p => 
            p.name.toLowerCase().includes(filter.name.toLowerCase())
          );
        }
        if (filter.minPrice !== undefined) {
          products = products.filter(p => p.price >= filter.minPrice);
        }
        if (filter.maxPrice !== undefined) {
          products = products.filter(p => p.price <= filter.maxPrice);
        }
        if (filter.sku) {
          products = products.filter(p => p.sku === filter.sku);
        }
      }
      
      // Apply sorting
      if (sort?.sortBy) {
        products.sort((a, b) => {
          const multiplier = sort.order === 'DESC' ? -1 : 1;
          switch (sort.sortBy) {
            case 'name':
              return multiplier * a.name.localeCompare(b.name);
            case 'price':
              return multiplier * (a.price - b.price);
            case 'sku':
              return multiplier * a.sku.localeCompare(b.sku);
            default:
              return 0;
          }
        });
      }
      
      this.logger.debug(`Retrieved ${products.length} products with filters: ${JSON.stringify(filter)} and sort: ${JSON.stringify(sort)}`);
      return products;
    } catch (error) {
      this.logger.error(`Error fetching products: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Query(() => Product, { nullable: true })
  async product(@Args('id', { type: () => Int }) id: number): Promise<Product | null> {
    try {
      const product = await this.productService.getProductById(id);
      if (!product) {
        this.logger.debug(`Product with id ${id} not found`);
      }
      return product;
    } catch (error) {
      this.logger.error(`Error fetching product ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Query(() => Product, { nullable: true })
  async productBySku(@Args('sku', { type: () => String }) sku: string): Promise<Product | null> {
    try {
      const products = await this.productService.getProducts();
      const product = products.find(p => p.sku === sku);
      if (!product) {
        this.logger.debug(`Product with SKU ${sku} not found`);
      }
      return product;
    } catch (error) {
      this.logger.error(`Error fetching product by SKU ${sku}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
