import { Injectable, NotFoundException, Inject } from '@nestjs/common'; // Import NotFoundException & Inject
import { ProductRepository } from './repository/product.repository';
import { Product } from './entity/product.entity';
import { RedisClientService } from '@lib/redis-client'; // Import RedisClientService
import { LoggerService } from '@lib/logger/src'; // Assuming a shared logger

const ALL_PRODUCTS_CACHE_KEY = 'all_products_list';
const PRODUCT_CACHE_KEY_PREFIX = 'product_';
const PRODUCT_CACHE_TTL_SECONDS = 3600; // 1 hour, adjust as needed

@Injectable()
export class ProductService {
  private readonly loggerContext = ProductService.name;

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly redisClient: RedisClientService,
    private readonly logger: LoggerService,
  ) {}

  async createProduct(product: Partial<Product>): Promise<Product> {
    const newProduct = await this.productRepository.create(product);
    // Invalidate all products cache and individual product cache if it exists
    await this.redisClient.del(ALL_PRODUCTS_CACHE_KEY);
    await this.redisClient.del(`${PRODUCT_CACHE_KEY_PREFIX}${newProduct.id}`);
    this.logger.info(`Product created with ID ${newProduct.id}, cache invalidated.`, this.loggerContext);
    return newProduct;
  }

  async getProducts(): Promise<Product[]> {
    this.logger.debug('Attempting to fetch all products.', this.loggerContext);
    const cachedProducts = await this.redisClient.getJson<Product[]>(ALL_PRODUCTS_CACHE_KEY);
    if (cachedProducts) {
      this.logger.info('Returning all products from cache.', this.loggerContext);
      return cachedProducts;
    }

    this.logger.info('Fetching all products from database.', this.loggerContext);
    const products = await this.productRepository.findAll();
    if (products && products.length > 0) {
      await this.redisClient.setJson(ALL_PRODUCTS_CACHE_KEY, products, PRODUCT_CACHE_TTL_SECONDS);
      this.logger.info('All products cached.', this.loggerContext);
    }
    return products;
  }

  async getProductById(id: number): Promise<Product> {
    const cacheKey = `${PRODUCT_CACHE_KEY_PREFIX}${id}`;
    this.logger.debug(`Attempting to fetch product by ID ${id}. Cache key: ${cacheKey}`, this.loggerContext);
    const cachedProduct = await this.redisClient.getJson<Product>(cacheKey);
    if (cachedProduct) {
      this.logger.info(`Returning product ID ${id} from cache.`, this.loggerContext);
      return cachedProduct;
    }

    this.logger.info(`Fetching product ID ${id} from database.`, this.loggerContext);
    const product = await this.productRepository.findOne(id);
    if (!product) {
      this.logger.info(`Product with ID ${id} not found in database.`, this.loggerContext); // Changed warn to info
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    await this.redisClient.setJson(cacheKey, product, PRODUCT_CACHE_TTL_SECONDS);
    this.logger.info(`Product ID ${id} cached.`, this.loggerContext);
    return product;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product> {
    this.logger.debug(`Attempting to update product ID ${id}.`, this.loggerContext);
    const existingProduct = await this.productRepository.findOne(id);
    if (!existingProduct) {
      this.logger.info(`Product with ID ${id} not found, cannot update.`, this.loggerContext); // Changed warn to info
      throw new NotFoundException(`Product with ID ${id} not found, cannot update.`);
    }
    const updatedProduct = await this.productRepository.update(id, productData);
    // Invalidate relevant caches
    await this.redisClient.del(ALL_PRODUCTS_CACHE_KEY);
    await this.redisClient.del(`${PRODUCT_CACHE_KEY_PREFIX}${id}`);
    this.logger.info(`Product ID ${id} updated, cache invalidated.`, this.loggerContext);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    this.logger.debug(`Attempting to delete product ID ${id}.`, this.loggerContext);
    const existingProduct = await this.productRepository.findOne(id);
    if (!existingProduct) {
      this.logger.info(`Product with ID ${id} not found, cannot delete.`, this.loggerContext); // Changed warn to info
      throw new NotFoundException(`Product with ID ${id} not found, cannot delete.`);
    }
    const result = await this.productRepository.delete(id);
    if (result) {
      // Invalidate relevant caches
      await this.redisClient.del(ALL_PRODUCTS_CACHE_KEY);
      await this.redisClient.del(`${PRODUCT_CACHE_KEY_PREFIX}${id}`);
      this.logger.info(`Product ID ${id} deleted, cache invalidated.`, this.loggerContext);
    }
    return result;
  }
}