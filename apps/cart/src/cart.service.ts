import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { LoggerService } from '@lib/logger/src';
import { KafkaProducer } from '@lib/kafka/KafkaProducer';
import { firstValueFrom, Observable } from 'rxjs';
import { CartRepository } from './repository/cart.repository';
import { CartItemRepository } from './repository/cart-item.repository';
import { Cart, CartStatus } from './entity/cart.entity';
import { CartItem } from './entity/cart-item.entity';
import { AddItemToCartDto, UpdateCartItemDto, CartItemDto } from './dto/cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { EntityManager } from 'typeorm';
import { TransactionService } from '@app/utils/transaction.service';

// Interface for Inventory Service (similar to order service)
interface InventoryService {
  validate(data: {
    orderItems: { productId: string; quantity: number }[];
  }): Observable<{ success: boolean; invalidOrderItems?: any[] }>; // Define more specific types later
}

@Injectable()
export class CartService {
  private context = CartService.name;
  private inventoryService: InventoryService;

  constructor(
    private readonly configService: ConfigService,
    @Inject('LoggerService') private readonly logger: LoggerService,
    @Inject('KafkaProducerInstance') private readonly kafkaProducer: KafkaProducer,
    @Inject('INVENTORY_PACKAGE') private readonly inventoryClient: ClientGrpc,
    private readonly cartRepository: CartRepository,
    private readonly cartItemRepository: CartItemRepository,
    private readonly transactionService: TransactionService,
  ) {}

  onModuleInit() {
    this.inventoryService = this.inventoryClient.getService<InventoryService>('InventoryService');
  }

  // Placeholder: Validate items with Inventory Service
  private async validateCartItems(
    items: { productId: string; quantity: number }[],
    traceId: string,
  ): Promise<void> {
    this.logger.info(`[${traceId}] Validating cart items: ${JSON.stringify(items)}`, this.context);
    if (!items || items.length === 0) {
      throw new BadRequestException('Cart items cannot be empty for validation.');
    }
    try {
      const validationResponse = await firstValueFrom(
        this.inventoryService.validate({ orderItems: items }),
      );
      this.logger.info(`[${traceId}] Inventory validation response: ${JSON.stringify(validationResponse)}`, this.context);
      if (!validationResponse.success) {
        throw new BadRequestException(
          `Inventory validation failed: ${JSON.stringify(validationResponse.invalidOrderItems)}`,
        );
      }
    } catch (error) {
      this.logger.error(`[${traceId}] Error validating items with inventory service: ${error.message}`, error.stack, this.context);
      throw new BadRequestException(`Failed to validate items with inventory: ${error.message}`);
    }
  }

  async getCartByUserId(userId: string, traceId?: string): Promise<CartResponseDto> {
    this.logger.info(`[${traceId}] Fetching cart for user ID: ${userId}`, this.context);
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) {
      this.logger.info(`[${traceId}] No cart found for user ID: ${userId}, creating a new one.`, this.context);
      // Create a new cart if one doesn't exist
      const newCart = await this.cartRepository.create({ userId });
      return this.mapCartToResponseDto(newCart);
    }
    return this.mapCartToResponseDto(cart);
  }

  async addItemToCart(
    userId: string,
    itemData: AddItemToCartDto,
    traceId: string,
  ): Promise<CartResponseDto> {
    this.logger.info(`[${traceId}] Adding item to cart for user ID: ${userId}, item: ${JSON.stringify(itemData)}`, this.context);

    // TODO: Fetch product price from Product/Inventory service instead of relying on client or hardcoding
    const productPrice = await this.fetchProductPrice(itemData.productId, traceId);
    if (productPrice === null) {
        throw new BadRequestException(`Product with ID ${itemData.productId} not found or price unavailable.`);
    }

    await this.validateCartItems([{ productId: itemData.productId, quantity: itemData.quantity }], traceId);

    return this.transactionService.executeInTransaction(async (entityManager: EntityManager) => {
        const cartRepo = this.cartRepository.getRepository(entityManager);
        const cartItemRepo = this.cartItemRepository.getRepository(entityManager);

        let cart = await cartRepo.findOne({ where: { userId, status: CartStatus.ACTIVE }});
        if (!cart) {
          cart = await cartRepo.save(cartRepo.create({ userId, status: CartStatus.ACTIVE, subTotal:0, grandTotal:0, totalItems:0 }));
          this.logger.info(`[${traceId}] Created new cart for user ID: ${userId}, cartId: ${cart.id}`, this.context);
        }

        let cartItem = await cartItemRepo.findOne({ where: { cartId: cart.id, productId: itemData.productId } });
        if (cartItem) {
          cartItem.quantity += itemData.quantity;
          cartItem.lineTotal = cartItem.quantity * cartItem.price; // Assuming price doesn't change on update
          await cartItemRepo.save(cartItem);
          this.logger.info(`[${traceId}] Updated item quantity in cart: ${cartItem.id}`, this.context);
        } else {
          cartItem = await cartItemRepo.save(cartItemRepo.create({
            cartId: cart.id,
            productId: itemData.productId,
            quantity: itemData.quantity,
            price: productPrice, // Use fetched price
            lineTotal: itemData.quantity * productPrice,
          }));
          this.logger.info(`[${traceId}] Added new item to cart: ${cartItem.id}`, this.context);
        }
        await this.recalculateCartTotals(cart, entityManager);
        const updatedCart = await cartRepo.findOne({ where: { id: cart.id }, relations: ['items'] });
        return this.mapCartToResponseDto(updatedCart);
    });
  }

  async updateCartItem(
    userId: string,
    cartItemId: string, // Assuming this is the CartItem ID
    updateData: UpdateCartItemDto,
    traceId: string,
  ): Promise<CartResponseDto> {
    this.logger.info(`[${traceId}] Updating cart item ID: ${cartItemId} for user ID: ${userId} with data: ${JSON.stringify(updateData)}`, this.context);

     return this.transactionService.executeInTransaction(async (entityManager: EntityManager) => {
        const cartRepo = this.cartRepository.getRepository(entityManager);
        const cartItemRepo = this.cartItemRepository.getRepository(entityManager);

        const cart = await cartRepo.findOne({ where: { userId, status: CartStatus.ACTIVE } });
        if (!cart) {
          throw new NotFoundException(`Active cart not found for user ID: ${userId}`);
        }

        const cartItem = await cartItemRepo.findOne({ where: { id: cartItemId, cartId: cart.id } });
        if (!cartItem) {
          throw new NotFoundException(`Item ID: ${cartItemId} not found in cart for user ID: ${userId}`);
        }

        await this.validateCartItems([{ productId: cartItem.productId, quantity: updateData.quantity }], traceId);

        cartItem.quantity = updateData.quantity;
        cartItem.lineTotal = cartItem.quantity * cartItem.price; // Assuming price doesn't change
        await cartItemRepo.save(cartItem);

        await this.recalculateCartTotals(cart, entityManager);
        const updatedCart = await cartRepo.findOne({ where: { id: cart.id }, relations: ['items'] });
        return this.mapCartToResponseDto(updatedCart);
    });
  }

  async removeItemFromCart(
    userId: string,
    cartItemId: string, // Assuming this is the CartItem ID
    traceId: string,
  ): Promise<CartResponseDto> {
    this.logger.info(`[${traceId}] Removing item ID: ${cartItemId} from cart for user ID: ${userId}`, this.context);
    return this.transactionService.executeInTransaction(async (entityManager: EntityManager) => {
        const cartRepo = this.cartRepository.getRepository(entityManager);
        const cartItemRepo = this.cartItemRepository.getRepository(entityManager);

        const cart = await cartRepo.findOne({ where: { userId, status: CartStatus.ACTIVE } });
        if (!cart) {
          throw new NotFoundException(`Active cart not found for user ID: ${userId}`);
        }

        const result = await cartItemRepo.delete({ id: cartItemId, cartId: cart.id });
        if (result.affected === 0) {
           throw new NotFoundException(`Item ID: ${cartItemId} not found in cart for user ID: ${userId}`);
        }

        await this.recalculateCartTotals(cart, entityManager);
        const updatedCart = await cartRepo.findOne({ where: { id: cart.id }, relations: ['items'] });
        return this.mapCartToResponseDto(updatedCart);
    });
  }

  async clearCart(userId: string, traceId: string): Promise<void> {
    this.logger.info(`[${traceId}] Clearing cart for user ID: ${userId}`, this.context);
     await this.transactionService.executeInTransaction(async (entityManager: EntityManager) => {
        const cartRepo = this.cartRepository.getRepository(entityManager);
        const cartItemRepo = this.cartItemRepository.getRepository(entityManager);

        const cart = await cartRepo.findOne({ where: { userId, status: CartStatus.ACTIVE } });
        if (cart) {
          await cartItemRepo.delete({ cartId: cart.id });
          cart.subTotal = 0;
          cart.grandTotal = 0;
          cart.totalItems = 0;
          cart.discountTotal = 0;
          cart.taxTotal = 0;
          // Optionally change cart status to ABANDONED or delete it
          // cart.status = CartStatus.ABANDONED;
          await cartRepo.save(cart);
          this.logger.info(`[${traceId}] Cart cleared for user ID: ${userId}`, this.context);
        } else {
          this.logger.info(`[${traceId}] No active cart to clear for user ID: ${userId}`, this.context);
        }
    });
  }

  private async fetchProductPrice(productId: string, traceId: string): Promise<number | null> {
    // This is a placeholder. In a real scenario, you would call the Product/Inventory service.
    // For now, let's assume a mock price or fetch from a simple map if testing.
    this.logger.info(`[${traceId}] Fetching price for product ID: ${productId}`, this.context);
    // Example: const productDetails = await this.productServiceClient.getProduct(productId);
    // if (productDetails && productDetails.price) return productDetails.price;
    // return null;
    const mockPrices = {
        "prod1": 100,
        "product-uuid-123": 25.99,
        "product-uuid-456": 19.99,
    };
    return mockPrices[productId] || 10.00; // Default mock price
  }

  private async recalculateCartTotals(cart: Cart, entityManager: EntityManager): Promise<void> {
    const cartItemRepo = this.cartItemRepository.getRepository(entityManager);
    const cartRepo = this.cartRepository.getRepository(entityManager);

    const items = await cartItemRepo.find({ where: { cartId: cart.id } });
    cart.subTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    cart.totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    // Add logic for discounts and taxes if applicable
    cart.discountTotal = 0; // Placeholder
    cart.taxTotal = 0; // Placeholder
    cart.grandTotal = cart.subTotal - cart.discountTotal + cart.taxTotal;
    await cartRepo.save(cart);
  }

  private mapCartToResponseDto(cart: Cart): CartResponseDto {
    if (!cart) return null;
    const itemsDto: CartItemDto[] = cart.items ? cart.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        // id: item.id // if you want to expose cartItem id
    })) : [];

    return {
        id: cart.id,
        userId: cart.userId,
        items: itemsDto,
        subTotal: cart.subTotal,
        totalItems: cart.totalItems,
        discount: cart.discountTotal,
        tax: cart.taxTotal,
        grandTotal: cart.grandTotal,
        updatedAt: cart.updatedAt,
    };
  }
}