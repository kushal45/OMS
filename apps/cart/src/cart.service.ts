import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ClientGrpc, RpcException } from '@nestjs/microservices'; // Added RpcException
import { ServiceLocator } from './service.locator'; // Import ServiceLocator from local file
import { firstValueFrom, Observable, catchError, throwError } from 'rxjs'; // Added catchError, throwError
import { Cart, CartStatus } from './entity/cart.entity';
import {
  AddItemToCartDto,
  UpdateCartItemDto,
  CartItemDto,
} from './dto/cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { EntityManager } from 'typeorm';
import { OutboxEvent, OutboxEventStatus } from './entity/outbox-event.entity';

// Interface for Inventory Service (similar to order service)
interface InventoryService {
  validate(data: {
    orderItems: { productId: string; quantity: number }[];
  }): Observable<{ success: boolean; invalidOrderItems?: any[] }>; // Define more specific types later
}

// Interface for Product Service client
interface ProductMessage {
  // Matches message in product.proto
  id: number;
  name: string;
  description: string;
  sku: string;
  price: number;
  attributes: string;
}

interface ProductService {
  getProductById(data: { productId: number }): Observable<ProductMessage>;
}

@Injectable()
export class CartService {
  private context = CartService.name;
  private inventoryService: InventoryService;
  private productService: ProductService;

  constructor(
    private readonly serviceLocator: ServiceLocator,
    @Inject('INVENTORY_PACKAGE') private readonly inventoryClient: ClientGrpc,
    @Inject('PRODUCT_PACKAGE') private readonly productClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.inventoryService =
      this.inventoryClient.getService<InventoryService>('InventoryService');
    this.productService =
      this.productClient.getService<ProductService>('ProductService');
  }

  // Validate items with Inventory Service
  private async validateCartItems(
    items: { productId: string; quantity: number }[],
    traceId: string,
  ): Promise<void> {
    this.serviceLocator
      .getLoggerService()
      .info(
        `[${traceId}] Validating cart items: ${JSON.stringify(items)}`,
        this.context,
      );
    if (!items || items.length === 0) {
      throw new BadRequestException(
        'Cart items cannot be empty for validation.',
      );
    }
    try {
      const validationResponse = await firstValueFrom(
        this.inventoryService.validate({ orderItems: items }),
      );
      this.serviceLocator
        .getLoggerService()
        .info(
          `[${traceId}] Inventory validation response: ${JSON.stringify(validationResponse)}`,
          this.context,
        );
      if (!validationResponse.success) {
        throw new BadRequestException(
          `Inventory validation failed: ${JSON.stringify(validationResponse.invalidOrderItems)}`,
        );
      }
    } catch (error) {
      this.serviceLocator
        .getLoggerService()
        .error(
          `[${traceId}] Error validating items with inventory service: ${error.message}`,
          error.stack,
          this.context,
        );
      throw new BadRequestException(
        `Failed to validate items with inventory: ${error.message}`,
      );
    }
  }

  async getCartByUserId(
    userId: string,
    traceId?: string,
  ): Promise<CartResponseDto> {
    this.serviceLocator
      .getLoggerService()
      .info(`[${traceId}] Fetching cart for user ID: ${userId}`, this.context);
    const cart = await this.serviceLocator
      .getCartDataService()
      .findByUserId(userId);
    if (!cart) {
      this.serviceLocator
        .getLoggerService()
        .info(
          `[${traceId}] No cart found for user ID: ${userId}, creating a new one.`,
          this.context,
        );
      // Create a new cart if one doesn't exist
      const newCart = await this.serviceLocator
        .getCartDataService()
        .create({ userId });
      return this.mapCartToResponseDto(newCart);
    }
    return this.mapCartToResponseDto(cart);
  }

  async addItemToCart(
    userId: string,
    itemData: AddItemToCartDto,
    traceId: string,
  ): Promise<CartResponseDto> {
    try {
      this.serviceLocator
        .getLoggerService()
        .info(
          `[${traceId}] Adding item to cart for user ID: ${userId}, item: ${JSON.stringify(itemData)}`,
          this.context,
        );

      // Fetch product price from Product/Inventory service
      const productPrice = await this.fetchProductPrice(
        itemData.productId,
        traceId,
      );
      if (productPrice === null) {
        throw new BadRequestException(
          `Price for product ID ${itemData.productId} could not be fetched or product not found.`,
        );
      }

      // Validate with Inventory Service (synchronous check)
      await this.validateCartItems(
        [{ productId: itemData.productId, quantity: itemData.quantity }],
        traceId,
      );

      // Transactional DB update + outbox event
      return this.serviceLocator
        .getTransactionService()
        .executeInTransaction(async (entityManager: EntityManager) => {
          const updatedCart = await this.persistCartAnditsItem({
            entityManager,
            productId: itemData.productId,
            quantity: itemData.quantity,
            productPrice,
            itemData,
            userId,
            traceId,
          });
          // Write outbox event in the same transaction
          const outboxRepo = entityManager.getRepository(OutboxEvent);
          const outboxEvent = outboxRepo.create({
            eventType: 'reserveInventory',
            payload: {
              userId,
              productId: itemData.productId,
              quantity: itemData.quantity,
              traceId,
              processType: 'ADD_ITEM_TO_CART',
              timestamp: new Date().toISOString(),
            },
            status: OutboxEventStatus.PENDING,
          });
          await outboxRepo.save(outboxEvent);
          return this.mapCartToResponseDto(updatedCart);
        });
    } catch (error) {
      this.serviceLocator
        .getLoggerService()
        .error(
          `[${traceId}] Error adding item to cart for user ID: ${userId}, item: ${JSON.stringify(itemData)}: ${error.message}`,
          error.stack,
          this.context,
        );
      throw new InternalServerErrorException(
        `Failed to add item to cart: ${error.message}`,
      );
    }
  }

  private async persistCartAnditsItem({
    entityManager,
    productId,
    quantity,
    productPrice,
    itemData,
    userId,
    traceId,
  }: {
    entityManager: EntityManager;
    productId: string;
    quantity: number;
    productPrice: number;
    itemData: AddItemToCartDto;
    userId: string;
    traceId: string;
  }): Promise<Cart> {
    this.serviceLocator
      .getLoggerService()
      .info(
        `Persisting cart item for, product ID: ${productId}, quantity: ${quantity}`,
        this.context,
      );
    const cartRepo = this.serviceLocator
      .getCartDataService()
      .getRepository(entityManager);
    const cartItemRepo = this.serviceLocator
      .getCartItemRepository()
      .getRepository(entityManager);

    // Use only custom repository methods
    let cart = await cartRepo.findByUserId(userId);
    if (!cart) {
      cart = await cartRepo.create({
        userId,
        status: CartStatus.ACTIVE,
      });
      this.serviceLocator
        .getLoggerService()
        .info(
          `[${traceId}] Created new cart for user ID: ${userId}, cartId: ${cart.id}`,
          this.context,
        );
    }

    // Use custom cartItemRepo methods (findByCartIdAndProductId, create, update, delete)
    let cartItem = await cartItemRepo.findByCartIdAndProductId(
      cart.id,
      itemData.productId,
    );
    if (cartItem) {
      cartItem.quantity += itemData.quantity;
      // Use only allowed fields for update
      await cartItemRepo.update(cartItem.id, {
        quantity: cartItem.quantity,
        // price is not updated here, only quantity
      });
      this.serviceLocator
        .getLoggerService()
        .info(
          `[${traceId}] Updated item quantity in cart: ${cartItem.id}`,
          this.context,
        );
    } else {
      // Do not include lineTotal in input, repository will calculate it
      cartItem = await cartItemRepo.create({
        cartId: cart.id,
        productId: itemData.productId,
        quantity: itemData.quantity,
        price: productPrice,
      });
      this.serviceLocator
        .getLoggerService()
        .info(
          `[${traceId}] Added new item to cart: ${cartItem.id}`,
          this.context,
        );
    }
    await this.recalculateCartTotals(cart, entityManager);
    return await cartRepo.findById(cart.id);
  }

  async updateCartItem(
    userId: string,
    cartItemId: string, // Accept as string from controller
    updateData: UpdateCartItemDto,
    traceId: string,
  ): Promise<CartResponseDto> {
    this.serviceLocator
      .getLoggerService()
      .info(
        `[${traceId}] Updating cart item ID: ${cartItemId} for user ID: ${userId} with data: ${JSON.stringify(updateData)}`,
        this.context,
      );
    return this.serviceLocator
      .getTransactionService()
      .executeInTransaction(async (entityManager: EntityManager) => {
        const cartRepo = this.serviceLocator
          .getCartDataService()
          .getRepository(entityManager);
        // Use the generic, entityManager-independent findOne
        const cart = await cartRepo.findByUserId(userId);
        if (!cart) {
          throw new NotFoundException(
            `Active cart not found for user ID: ${userId}`,
          );
        }

        const cartItem = await this.serviceLocator
          .getCartItemRepository()
          .findOne({ id: cartItemId, cartId: cart.id });
        if (!cartItem) {
          throw new NotFoundException(
            `Item ID: ${cartItemId} not found in cart for user ID: ${userId}`,
          );
        }
        if (updateData.quantity <= 0) {
          throw new BadRequestException(
            `Quantity must be greater than zero for item ID: ${cartItemId}`,
          );
        }
        const diffQuantity = updateData.quantity - cartItem.quantity;
        if (diffQuantity === 0) {
          this.serviceLocator
            .getLoggerService()
            .info(
              `[${traceId}] No change in quantity for item ID: ${cartItemId}, skipping update.`,
              this.context,
            );
          return this.mapCartToResponseDto(cart);
        }
        if (diffQuantity < 0) {
          throw new BadRequestException(
            `Cannot reduce quantity below zero for item ID: ${cartItemId}. Current: ${cartItem.quantity}, Requested: ${updateData.quantity}`,
          );
        }

        await this.validateCartItems(
          [{ productId: cartItem.productId, quantity: updateData.quantity }],
          traceId,
        );

        // Use custom repository update method (still transactional)
        await this.serviceLocator
          .getCartItemRepository()
          .getRepository(entityManager)
          .update(cartItem.id, { quantity: updateData.quantity });
        await this.recalculateCartTotals(cart, entityManager);
        const updatedCart = await cartRepo.findById(cart.id);

        // Outbox pattern: create UPDATE_CART_ITEM event in same transaction
        const outboxRepo = entityManager.getRepository(OutboxEvent);
        const outboxEvent = outboxRepo.create({
          eventType: 'reserveInventory',
          payload: {
            userId,
            cartItemId,
            productId: cartItem.productId,
            quantity: diffQuantity,
            traceId,
            processType: 'UPDATE_CART_ITEM',
            timestamp: new Date().toISOString(),
          },
          status: OutboxEventStatus.PENDING,
        });
        await outboxRepo.save(outboxEvent);

        return this.mapCartToResponseDto(updatedCart);
      });
  }

  async removeItemFromCart(
    userId: string,
    cartItemId: string, // Accept as string from controller
    traceId: string,
  ): Promise<CartResponseDto> {
    this.serviceLocator
      .getLoggerService()
      .info(
        `[${traceId}] Removing item ID: ${cartItemId} from cart for user ID: ${userId}`,
        this.context,
      );
    return this.serviceLocator
      .getTransactionService()
      .executeInTransaction(async (entityManager: EntityManager) => {
        const cartRepo = this.serviceLocator
          .getCartDataService()
          .getRepository(entityManager);
        const cartItemRepo = this.serviceLocator
          .getCartItemRepository()
          .getRepository(entityManager);

        const cart = await cartRepo.findByUserId(userId);
        if (!cart) {
          throw new NotFoundException(
            `Active cart not found for user ID: ${userId}`,
          );
        }

        const cartItem = await cartItemRepo.findOne({
          id: cartItemId,
          cartId: cart.id,
        });
        if (!cartItem) {
          throw new NotFoundException(
            `Item ID: ${cartItemId} not found in cart for user ID: ${userId}`,
          );
        }

        const deleted = await cartItemRepo.delete(cartItem.id);
        if (!deleted) {
          throw new NotFoundException(
            `Item ID: ${cartItemId} not found in cart for user ID: ${userId}`,
          );
        }

        await this.recalculateCartTotals(cart, entityManager);
        const updatedCart = await cartRepo.findById(cart.id);
        return this.mapCartToResponseDto(updatedCart);
      });
  }

  async clearCart(userId: string, traceId: string): Promise<void> {
    this.serviceLocator
      .getLoggerService()
      .info(`[${traceId}] Clearing cart for user ID: ${userId}`, this.context);
    await this.serviceLocator
      .getTransactionService()
      .executeInTransaction(async (entityManager: EntityManager) => {
        const cartRepo = this.serviceLocator
          .getCartDataService()
          .getRepository(entityManager);
        const cartItemRepo = this.serviceLocator
          .getCartItemRepository()
          .getRepository(entityManager);

        const cart = await cartRepo.findByUserId(userId);
        if (cart) {
          await cartItemRepo.deleteByCartId(cart.id);
          cart.subTotal = 0;
          cart.grandTotal = 0;
          cart.totalItems = 0;
          cart.discountTotal = 0;
          cart.taxTotal = 0;
          // Optionally change cart status to ABANDONED or delete it
          cart.status = CartStatus.ABANDONED;
          await cartRepo.update(cart.id, cart);
          this.serviceLocator
            .getLoggerService()
            .info(
              `[${traceId}] Cart cleared for user ID: ${userId}`,
              this.context,
            );
        } else {
          this.serviceLocator
            .getLoggerService()
            .info(
              `[${traceId}] No active cart to clear for user ID: ${userId}`,
              this.context,
            );
        }
      });
  }

  private async fetchProductPrice(
    productIdString: string,
    traceId: string,
  ): Promise<number | null> {
    this.serviceLocator
      .getLoggerService()
      .info(
        `[${traceId}] Attempting to fetch price for product ID: ${productIdString}`,
        this.context,
      );
    let productId: number;
    try {
      productId = parseInt(productIdString, 10);
      if (isNaN(productId)) {
        this.serviceLocator
          .getLoggerService()
          .error(
            `[${traceId}] Invalid product ID format: ${productIdString}. Must be a number.`,
            '',
            this.context,
          );
        throw new BadRequestException(
          `Invalid product ID format: ${productIdString}.`,
        );
      }
    } catch (parseError) {
      this.serviceLocator
        .getLoggerService()
        .error(
          `[${traceId}] Error parsing product ID ${productIdString}: ${parseError.message}`,
          parseError.stack,
          this.context,
        );
      throw new BadRequestException(
        `Invalid product ID format: ${productIdString}.`,
      );
    }

    try {
      const productDetails = await firstValueFrom(
        this.productService.getProductById({ productId }).pipe(
          catchError((err) => {
            // Rethrow RpcException to be caught by the outer try-catch
            return throwError(() => err);
          }),
        ),
      );

      if (productDetails && typeof productDetails.price === 'number') {
        this.serviceLocator
          .getLoggerService()
          .info(
            `[${traceId}] Successfully fetched price for product ID ${productId}: ${productDetails.price}`,
            this.context,
          );
        return productDetails.price;
      } else {
        this.serviceLocator
          .getLoggerService()
          .info(
            `[${traceId}] Product ID ${productId} found but price is missing or invalid. Response: ${JSON.stringify(productDetails)}`,
            this.context,
          ); // Changed to info
        return null; // Or throw specific error
      }
    } catch (error) {
      if (error instanceof RpcException) {
        const grpcError = error.getError();
        // Standard gRPC status codes: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
        // 5 is NOT_FOUND
        if (
          typeof grpcError === 'object' &&
          grpcError !== null &&
          'code' in grpcError &&
          grpcError.code === 5
        ) {
          this.serviceLocator
            .getLoggerService()
            .info(
              `[${traceId}] Product with ID ${productId} not found via gRPC ProductService.`,
              this.context,
            ); // Changed to info
          return null; // Product not found
        } else {
          this.serviceLocator
            .getLoggerService()
            .error(
              `[${traceId}] gRPC error fetching price for product ID ${productId}: ${error.message}`,
              error.stack,
              this.context,
            );
          throw new BadRequestException(
            `Failed to fetch price for product ID ${productId} due to a service error.`,
          );
        }
      }
      this.serviceLocator
        .getLoggerService()
        .error(
          `[${traceId}] Unexpected error fetching price for product ID ${productId}: ${error.message}`,
          error.stack,
          this.context,
        );
      throw new BadRequestException(
        `An unexpected error occurred while fetching price for product ID ${productId}.`,
      );
    }
  }

  private async recalculateCartTotals(
    cart: Cart,
    entityManager?: EntityManager,
  ): Promise<void> {
    // Use only custom repository methods
    try {
      const cartItemRepo = this.serviceLocator
        .getCartItemRepository()
        .getRepository(entityManager);
      const cartRepo = this.serviceLocator
        .getCartDataService()
        .getRepository(entityManager);
      const items = await cartItemRepo.findByCartId(cart.id);
      cart.subTotal = items.reduce((sum, item) => {
        const lineTotal = typeof item.lineTotal === 'number' ? item.lineTotal : parseFloat(item.lineTotal);
        return sum + (isNaN(lineTotal) ? 0 : lineTotal);
      }, 0);
      cart.totalItems = items.reduce((sum, item) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity);
        return sum + (isNaN(qty) ? 0 : qty);
      }, 0);
      // For now, assume no discounts or taxes
      cart.discountTotal = 0;
      cart.taxTotal = 0;
      cart.grandTotal = cart.subTotal;
      await cartRepo.update(cart.id, {
        subTotal: cart.subTotal,
        totalItems: cart.totalItems,
        discountTotal: cart.discountTotal,
        taxTotal: cart.taxTotal,
        grandTotal: cart.grandTotal,
      });
    } catch (error) {
      this.serviceLocator
        .getLoggerService()
        .error(
          `Error recalculating cart totals for cart ID ${cart.id}: ${error.message}`,
          error.stack,
          this.context,
        );
      throw new InternalServerErrorException(
        `Failed to recalculate cart totals: ${error.message}`,
      );
    }
  }

  private mapCartToResponseDto(cart: Cart): CartResponseDto {
    if (!cart) return null;
    const itemsDto: CartItemDto[] = cart.items
      ? cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          // id: item.id // if you want to expose cartItem id
        }))
      : [];

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
