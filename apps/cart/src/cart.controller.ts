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
import { registerSchema, deleteSchema } from '@app/utils/SchemaRegistry';
import { ConfigService } from '@nestjs/config';

@ApiTags('cart')
@ApiSecurity('api-key')
@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly moduleRef: ModuleRef,
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
    @Param('userId') userId: string,
    @Res() response,
    @Req() req,
  ) {
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
    @Param('user_id') userId: string,
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
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
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
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
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
    @Param('userId') userId: string,
    @Res() response,
    @Req() req,
  ) {
    const traceId = req.headers['x-correlation-id'] || 'default-trace-id';
    await this.cartService.clearCart(userId, traceId);
    ResponseUtil.success({
      response,
      message: 'Cart cleared successfully.',
      statusCode: HttpStatus.NO_CONTENT,
    });
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
    await this.handleInventoryProcessTypeRegistration(topic, schemaJsonString);
    await this.handleInventoryProcessTypeRegistration(
      releaseTopic,
      schemaReleaseJsonString,
      'release',
    );
  }

  async handleInventoryProcessTypeRegistration(
    topic: string,
    schemaJsonString: string,
    processType: 'reserve' | 'release' = 'reserve',
  ) {
    try {
      console.log(`Registering schema for topic: ${topic}`);
      await deleteSchema(this.moduleRef, topic);
      if (!schemaJsonString) {
        console.error(
          `Schema JSON string not found in config for topic: ${topic}. Ensure  ${processType} json is set in the .env file.`,
        );
        // Potentially throw an error or handle as appropriate for your application
        return;
      }

      let parsedSchema;
      try {
        parsedSchema = JSON.parse(schemaJsonString);
      } catch (error) {
        console.error(
          `Error parsing schema JSON string for topic ${topic}:`,
          error,
          `Schema string: ${schemaJsonString}`,
        );
        // Potentially throw an error or handle as appropriate
        return;
      }

      console.log(
        `Schema definition for topic ${topic}: ${JSON.stringify(parsedSchema)}`,
      );
      await registerSchema(this.moduleRef, topic, parsedSchema);
    } catch (error) {
      console.error(
        `Error during schema registration for topic ${topic}:`,
        error,
      );
      // Depending on the desired behavior, you might want to:
      // - Throw the error to stop the process (if it's critical)
      // - Log and continue (current behavior)
      // - Handle the error in a way that allows the application to recover
      return;
    }
  }
}
