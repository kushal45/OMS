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
  NotAcceptableException,
  Inject,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './entity/order.entity';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponse } from '../../utils/response.decorator';
import { OrderRequestDto } from './dto/create-order-req';
import { ResponseErrDto } from '@app/utils/dto/response-err.dto';
import { CreateOrderResponseDto } from './dto/create-order-res';
import { ResponseUtil } from '@app/utils/response.util';
import { OrderResponseDto } from './dto/get-order-res';
import { OrderItemsResponseDto } from './dto/get-order-items-res';
import { UpdateOrderDto } from './dto/update-order-req.dto';
import { deleteSchema, registerSchema } from '@app/utils/SchemaRegistry';
import { ModuleRef } from '@nestjs/core';

@ApiTags('order')
@ApiSecurity('api-key')
@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Post('orders')
  @ApiOperation({ summary: 'Create new Order' })
  @ApiResponse(
    CreateOrderResponseDto,
    201,
    false,
    {
      message: 'Order created successfully.',
      data: {
        id: 1,
        aliasId: 'ORD-123',
        userId: 1,
        status: 'created',
        total: 100.0,
        createdAt: '2025-05-31T12:00:00.000Z',
        updatedAt: '2025-05-31T12:00:00.000Z',
        // ...add other fields as needed
      },
      status: 'success'
    }
  )
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @ApiBody({ type: OrderRequestDto })
  async createOrder(
    @Req() req,
    @Body() order: OrderRequestDto,
    @Res() response,
  ) {
    try {
      const userObj = JSON.parse(req.headers['x-user-data']);
      const userId = userObj.id;
      const traceId = req.headers['x-correlation-id'] || 'default-trace-id';

      const orderRes = await this.orderService.createOrder(
        order,
        userId,
        traceId,
      );
      ResponseUtil.success({
        response,
        message: 'Order created successfully.',
        data: orderRes,
        statusCode: HttpStatus.CREATED,
      });
    } catch (error) {
      ResponseUtil.error({
        response,
        message: error.message,
        statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message || 'Internal Server Error',
      });
    }
  }

  @Get('health')
  async health(@Res() response) {
    response.status(HttpStatus.OK).send('OK');
  }

  @Get(':aliasId')
  @ApiResponse(
    OrderResponseDto,
    200,
    false,
    {
      message: 'Order fetched successfully.',
      data: {
        id: 1,
        aliasId: 'ORD-123',
        userId: 1,
        status: 'created',
        total: 100.0,
        createdAt: '2025-05-31T12:00:00.000Z',
        updatedAt: '2025-05-31T12:00:00.000Z',
        // ...add other fields as needed
      },
      status: 'success'
    }
  )
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @ApiParam({ name: 'aliasId', required: true })
  async getOrderById(@Param('aliasId') aliasId: string, @Res() response) {
    const order = await this.orderService.getOrderById(aliasId);
    ResponseUtil.success({
      response,
      message: 'Order fetched successfully.',
      data: order,
      statusCode: HttpStatus.OK,
    });
  }

  @Get(':aliasId/orderItems')
  @ApiResponse(
    OrderItemsResponseDto,
    200,
    true,
    {
      message: 'Order items fetched successfully.',
      data: [
        {
          id: 1,
          orderId: 1,
          productId: 1,
          quantity: 2,
          price: 50.0,
          // ...add other fields as needed
        }
      ],
      status: 'success'
    }
  )
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @ApiParam({ name: 'aliasId', required: true })
  async getOrderItems(@Param('aliasId') aliasId: string, @Res() response) {
    const orderItems = await this.orderService.getOrderItems(aliasId);
    ResponseUtil.success({
      response,
      message: 'Order items fetched successfully.',
      data: orderItems,
      statusCode: HttpStatus.OK,
    });
  }

  @Get('user/:userId')
  async getOrders(@Param('userId') userId: number): Promise<Order[]> {
    return await this.orderService.getOrders(userId);
  }

  @Put(':aliasId')
  @ApiParam({ name: 'aliasId', required: true })
  @ApiResponse(
    CreateOrderResponseDto,
    200,
    false,
    {
      message: 'Order updated successfully.',
      data: {
        id: 1,
        aliasId: 'ORD-123',
        userId: 1,
        status: 'updated',
        total: 120.0,
        createdAt: '2025-05-31T12:00:00.000Z',
        updatedAt: '2025-05-31T12:10:00.000Z',
        // ...add other fields as needed
      },
      status: 'success'
    }
  )
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @ApiBody({ type: UpdateOrderDto })
  async updateOrder(
    @Param('aliasId') aliasId: string,
    @Body() order: UpdateOrderDto,
    @Res() response,
  ) {
    const orderResponse = await this.orderService.updateOrder(aliasId, order);
    ResponseUtil.success({
      response,
      message: 'Order updated successfully.',
      data: orderResponse,
      statusCode: HttpStatus.OK,
    });
  }

  @Put(':aliasId/cancel')
  async cancelOrder(@Param('aliasId') aliasId: string): Promise<Order> {
    return await this.orderService.cancelOrder(aliasId);
  }

  @Delete(':id')
  async deleteOrder(@Param('id') id: number, @Res() response) {
    if (!(await this.orderService.deleteOrder(id)))
      throw new NotAcceptableException('Order not Deleted');
    ResponseUtil.success({
      response,
      message: 'Order deleted successfully.',
      statusCode: HttpStatus.NO_CONTENT,
    });
  }

  async onModuleInit() {
    await deleteSchema(this.moduleRef);
    await registerSchema(this.moduleRef);
  }
}
