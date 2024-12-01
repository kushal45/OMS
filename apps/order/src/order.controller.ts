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
} from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './entity/order.entity';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../utils/response.decorator';
import { OrderRequestDto } from './dto/create-order-req';
import { ResponseErrDto } from '@app/utils/dto/response-err.dto';
import { ApiResponseFormat } from '@app/utils/dto/response-format.dto';
import { CreateOrderResponseDto } from './dto/create-order-res';
import { ResponseUtil } from '@app/utils/response.util';
import { OrderItems } from './entity/orderItems.entity';
import { OrderResponseDto } from './dto/get-order-res';
import { OrderItemsResponseDto } from './dto/get-order-items-res';
import { UpdateOrderDto } from './dto/update-order-req.dto';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Create new Order' })
  @ApiResponse(ApiResponseFormat(CreateOrderResponseDto), 201)
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @Post()
  @ApiBody({ type: OrderRequestDto })
  async createOrder(
    @Req() req,
    @Body() order: OrderRequestDto,
    @Res() response,
  ) {
    try {
      const userObj = JSON.parse(req.headers['x-user-data']);
      const userId = userObj.id;
      console.log('userId', userId);
      const orderRes = await this.orderService.createOrder(order, userId);
      ResponseUtil.success({
        response,
        message: 'Order created successfully.',
        data: orderRes,
        statusCode: HttpStatus.CREATED,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get(':aliasId')
  @ApiResponse(ApiResponseFormat(OrderResponseDto), 200)
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @ApiParam({ name: 'aliasId', required: true })
  async getOrderById(@Param('aliasId') aliasId: string,@Res() response) {
    const order= await this.orderService.getOrderById(aliasId);
    ResponseUtil.success({
      response,
      message: 'Order fetched successfully.',
      data: order,
      statusCode: HttpStatus.OK,
    });
  }

  @Get(":aliasId/orderItems")
  @ApiResponse(ApiResponseFormat(OrderItemsResponseDto), 200)
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @ApiParam({ name: 'aliasId', required: true })
  async getOrderItems(@Param('aliasId') aliasId: string): Promise<OrderItems[]> {
    return await this.orderService.getOrderItems(aliasId);
  }

  @Get('user/:userId')
  async getOrders(@Param('userId') userId: number): Promise<Order[]> {
    return await this.orderService.getOrders(userId);
  }

  @Put(':aliasId')
  @ApiParam({ name: 'aliasId', required: true })
  @ApiResponse(ApiResponseFormat(CreateOrderResponseDto), 200)
  @ApiResponse(ResponseErrDto, 400)
  @ApiResponse(ResponseErrDto, 500)
  @ApiBody({ type: UpdateOrderDto })
  async updateOrder(
    @Param('aliasId') aliasId: string,
    @Body() order: UpdateOrderDto,
    @Res() response,
  ) {
    const orderResponse= await this.orderService.updateOrder(aliasId, order);
    ResponseUtil.success({
      response,
      message: 'Order updated successfully.',
      data: orderResponse,
      statusCode: HttpStatus.OK,
    })
  }

  @Put(':aliasId/cancel')
  async cancelOrder(@Param('aliasId') aliasId: string): Promise<Order> {
    return await this.orderService.cancelOrder(aliasId);
  }

  @Delete(':id')
  async deleteOrder(@Param('id') id: number): Promise<void> {
    return await this.orderService.deleteOrder(id);
  }
}
