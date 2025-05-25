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
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '@app/utils/response.decorator';
import { AddItemToCartDto, UpdateCartItemDto } from './dto/cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { ResponseErrDto } from '@app/utils/dto/response-err.dto';
import { ApiResponseFormat } from '@app/utils/dto/response-format.dto';
import { ResponseUtil } from '@app/utils/response.util';
import { ModuleRef } from '@nestjs/core';
import { registerSchema } from '@app/utils/SchemaRegistry';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly moduleRef: ModuleRef
  ) {}

  @Get("health")
  async health(@Res() response) {
    response.status(HttpStatus.OK).send('OK');
  }

  // Placeholder for Get Cart by User ID
  @ApiOperation({ summary: 'Get cart by user ID' })
  @ApiResponse(ApiResponseFormat(CartResponseDto), 200)
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Get('user/:userId')
  async getCartByUserId(@Param('userId') userId: string, @Res() response, @Req() req) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    const cart = await this.cartService.getCartByUserId(userId, traceId);
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
  @ApiResponse(ApiResponseFormat(CartResponseDto), 201)
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Post('user/:userId/item')
  async addItemToCart(
    @Param('userId') userId: string,
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
  @ApiResponse(ApiResponseFormat(CartResponseDto), 200)
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Put('user/:userId/item/:itemId')
  async updateCartItem(
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
    @Body() update: UpdateCartItemDto,
    @Res() response,
    @Req() req,
  ) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    const cart = await this.cartService.updateCartItem(userId, itemId, update, traceId);
    ResponseUtil.success({
      response,
      message: 'Cart item updated successfully.',
      data: cart,
      statusCode: HttpStatus.OK,
    });
  }

  // Placeholder for Remove Item from Cart
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse(ApiResponseFormat(CartResponseDto), 200) // Assuming it returns the updated cart
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Delete('user/:userId/item/:itemId')
  async removeItemFromCart(
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
    @Res() response,
    @Req() req,
  ) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    const cart = await this.cartService.removeItemFromCart(userId, itemId, traceId);
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
  async clearCart(@Param('userId') userId: string, @Res() response, @Req() req) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    await this.cartService.clearCart(userId, traceId);
    ResponseUtil.success({
      response,
      message: 'Cart cleared successfully.',
      statusCode: HttpStatus.NO_CONTENT,
    });
  }

  async onModuleInit() {
    await registerSchema(this.moduleRef);
  }
}