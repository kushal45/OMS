import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  HttpStatus,
  Res,
  Inject,
} from '@nestjs/common';
import { CartService } from './cart.service';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponse } from '@app/utils/response.decorator';
import { AddItemToCartDto, UpdateCartItemDto } from './dto/cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { ResponseErrDto } from '@app/utils/dto/response-err.dto';
import { ResponseUtil } from '@app/utils/response.util';
import { ModuleRef } from '@nestjs/core';
import { handleInventoryProcessTypeRegistration } from '@app/utils/SchemaRegistry';
import { ConfigService } from '@nestjs/config';
import { GrpcMethod } from '@nestjs/microservices';

@ApiTags('cart')
@ApiSecurity('api-key')
@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly moduleRef: ModuleRef,
    @Inject('ISchemaRegistryService') private readonly schemaRegistryService: any,
  ) {}

  @Get('health')
  async health(@Res() response) {
    response.status(HttpStatus.OK).send('OK');
  }

  // Placeholder for Get Cart by User ID
  @ApiOperation({ summary: 'Get cart by user ID' })
  @ApiResponse(CartResponseDto, 200, false, {
    message: 'Cart fetched successfully.',
    data: {
      userId: 'user-123',
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          price: 10.0,
        },
      ],
      total: 20.0,
    },
    status: 'success',
  })
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Get('user/:userId')
  async getCartByUserId(
    @Param('userId') userId: number,
    @Res() response,
    @Req() req,
  ) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    const cart = await this.cartService.getCartByUserIdHttp(userId, traceId); // Changed to getCartByUserIdHttp
    ResponseUtil.success({
      response,
      message: 'Cart fetched successfully.',
      data: cart,
      statusCode: HttpStatus.OK,
    });
  }

  // Placeholder for Add Item to Cart
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiBody({ type: AddItemToCartDto })
  @ApiResponse(CartResponseDto, 201, false, {
    message: 'Item added to cart successfully.',
    data: {
      userId: 'user-123',
      items: [
        {
          productId: 'prod-1',
          quantity: 3,
          price: 10.0,
        },
      ],
      total: 30.0,
    },
    status: 'success',
  })
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Post('user/:user_id/item')
  async addItemToCart(
    @Param('user_id') userId: number,
    @Body() item: AddItemToCartDto,
    @Res() response,
    @Req() req,
  ) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    const cart = await this.cartService.addItemToCart(userId, item, traceId);
    ResponseUtil.success({
      response,
      message: 'Item added to cart successfully.',
      data: cart,
      statusCode: HttpStatus.CREATED,
    });
  }

  // Placeholder for Update Cart Item
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse(CartResponseDto, 200, false, {
    message: 'Cart item updated successfully.',
    data: {
      userId: 'user-123',
      items: [
        {
          productId: 'prod-1',
          quantity: 5,
          price: 10.0,
        },
      ],
      total: 50.0,
    },
    status: 'success',
  })
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Put('user/:userId/item/:itemId')
  async updateCartItem(
    @Param('userId') userId: number,
    @Param('itemId') itemId: number,
    @Body() update: UpdateCartItemDto,
    @Res() response,
    @Req() req,
  ) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    const cart = await this.cartService.updateCartItem(
      userId,
      itemId,
      update,
      traceId,
    );
    ResponseUtil.success({
      response,
      message: 'Cart item updated successfully.',
      data: cart,
      statusCode: HttpStatus.OK,
    });
  }

  // Placeholder for Remove Item from Cart
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse(CartResponseDto, 200, false, {
    message: 'Item removed from cart successfully.',
    data: {
      userId: 'user-123',
      items: [],
      total: 0.0,
    },
    status: 'success',
  })
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Delete('user/:userId/item/:itemId')
  async removeItemFromCart(
    @Param('userId') userId: number,
    @Param('itemId') itemId: number,
    @Res() response,
    @Req() req,
  ) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    const cart = await this.cartService.removeItemFromCart(
      userId,
      itemId,
      traceId,
    );
    ResponseUtil.success({
      response,
      message: 'Item removed from cart successfully.',
      data: cart,
      statusCode: HttpStatus.OK,
    });
  }

  // Placeholder for Clear Cart
  @ApiOperation({ summary: 'Clear cart for a user' })
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Delete('user/:userId')
  async clearCart(
    @Param('userId') userId: number,
    @Res() response,
    @Req() req,
  ) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    const type = 'clear-cart';
    await this.cartService.clearCart(userId, traceId, type);
    ResponseUtil.success({
      response,
      message: 'Cart cleared successfully.',
      statusCode: HttpStatus.NO_CONTENT,
    });
  }

  // gRPC method to fetch active cart and its items for a user
  @GrpcMethod('CartService', 'getActiveCartByUserId')
  async getActiveCartByUserIdGrpc(
    data: { userId: string },
    _metadata?: any,
  ): Promise<CartResponseDto | null> {
    const cart = await this.cartService.getActiveCartByUserId(data); // Calls the gRPC handler in service
    return cart;
  }

  // gRPC method to clear cart by userId
  @GrpcMethod('CartService', 'clearCartByUserId')
  async clearCartByUserIdGrpc(
    data: { userId: number },
    _metadata?: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const type= 'place-order';
      await this.cartService.clearCart(data.userId, `grpc-clearCart-${Date.now()}-${data.userId}`,type);
      return { success: true, message: 'Cart cleared successfully.' };
    } catch (error) {
      return { success: false, message: error?.message || 'Failed to clear cart.' };
    }
  }

  async onModuleInit() {
    const configService = this.moduleRef.get<ConfigService>(ConfigService, {
      strict: false,
    });
    const topic = configService.get<string>('INVENTORY_RESERVE_TOPIC');
    const releaseTopic = configService.get<string>('INVENTORY_RELEASE_TOPIC');
    const schemaJsonString = configService.get<string>(
      'INVENTORY_RESERVE_SCHEMA_JSON',
    );
    const schemaReleaseJsonString = configService.get<string>(
      'INVENTORY_RELEASE_SCHEMA_JSON',
    );
  await handleInventoryProcessTypeRegistration(topic, schemaJsonString, this.moduleRef, this.schemaRegistryService);
    await handleInventoryProcessTypeRegistration(
      releaseTopic,
      schemaReleaseJsonString,
      this.moduleRef,
      this.schemaRegistryService,
    );
  }
}
