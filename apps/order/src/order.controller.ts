import { Controller, Get, Post, Put, Delete, Body, Param, Req, HttpStatus, Res } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './entity/order.entity';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../utils/response.decorator';
import { OrderRequestDto } from './dto/order-request.dto';
import { ResponseErrDto } from '@app/utils/dto/response-err.dto';
import { ApiResponseFormat } from '@app/utils/dto/response-format.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { ResponseUtil } from '@app/utils/response.util';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Create new Order' })
  @ApiResponse(ApiResponseFormat(OrderResponseDto), 201)
  @ApiResponse(ResponseErrDto,400)
  @ApiResponse(ResponseErrDto,500)
  @Post()
  @ApiBody({ type: OrderRequestDto })
  async createOrder(@Req() req, @Body() order: OrderRequestDto, @Res() response) {
    const userObj= JSON.parse(req.headers['x-user-data']);
    const userId= userObj.id;
    const orderRes=this.orderService.createOrder(order, userId);
    ResponseUtil.success({
      response,
      message: 'Order created successfully.',
      data: orderRes,
      statusCode:HttpStatus.CREATED
    });
  }

  @Get(':id')
  async getOrderById(@Param('id') id: number): Promise<Order> {
    return this.orderService.getOrderById(id);
  }

  @Get('user/:userId')
  async getOrders(@Param('userId') userId: number): Promise<Order[]> {
    return this.orderService.getOrders(userId);
  }

  @Put(':id')
  async updateOrder(@Param('id') id: number, @Body() order: Partial<Order>): Promise<Order> {
    return this.orderService.updateOrder(id, order);
  }

  @Delete(':id')
  async deleteOrder(@Param('id') id: number): Promise<void> {
    return this.orderService.deleteOrder(id);
  }
}