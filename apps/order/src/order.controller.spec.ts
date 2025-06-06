import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRequestDto } from './dto/create-order-req';
import { UpdateOrderDto } from './dto/update-order-req.dto';
import { JwtAuthGuard } from '../../../apps/auth/src/guards/jwt-auth.guard'; // Adjusted path
import { HttpStatus } from '@nestjs/common';
import { CreateOrderResponseDto } from './dto/create-order-res';
import { Order } from './entity/order.entity';
import { OrderItems } from './entity/orderItems.entity';

// Mock JwtAuthGuard to prevent actual auth logic during tests
const mockJwtAuthGuard = {
  canActivate: jest.fn(() => true),
};

describe('OrderController', () => {
  let orderController: OrderController;
  let orderService: OrderService;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(async () => {
    mockRequest = {
      user: { userId: 1 }, // Mock user from JWT payload
      params: {},
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            createOrder: jest.fn(),
            getOrders: jest.fn(),
            getOrderById: jest.fn(),
            getOrderItems: jest.fn(),
            updateOrder: jest.fn(),
            cancelOrder: jest.fn(),
            // Add other methods from OrderService if they are used by the controller
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard) // Override the actual guard with a mock
    .useValue(mockJwtAuthGuard)
    .compile();

    orderController = module.get<OrderController>(OrderController);
    orderService = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(orderController).toBeDefined();
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const orderRequestDto: OrderRequestDto = {
        addressId: 1,
        orderItems: [{ productId: 1, price: 100, quantity: 1 }],
      };
      const expectedResponse: CreateOrderResponseDto = {
        aliasId: 'some-uuid',
        status: 'Pending' as any, // Corrected: 'status' instead of 'orderStatus', cast as any for enum
        totalAmount: 100,
        deliveryCharge: 10,
        tax: 5,
      };
      jest.spyOn(orderService, 'createOrder').mockResolvedValue(expectedResponse);

      // createOrder in controller uses @Req() req, @Body() order, @Res() response
      // The mockRequest.user.userId is extracted inside the controller from x-user-data header.
      // For the test, we ensure mockRequest.user.userId is available if the service method needs it directly.
      // However, the controller method itself extracts userId from req.headers['x-user-data'].
      // So, we need to mock req.headers['x-user-data'] for the controller test.
      mockRequest.headers['x-user-data'] = JSON.stringify({ id: mockRequest.user.userId });

      await orderController.createOrder(mockRequest, orderRequestDto, mockResponse);

      expect(orderService.createOrder).toHaveBeenCalledWith(orderRequestDto, mockRequest.user.userId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Order created successfully',
          data: expectedResponse,
        }),
      );
    });
  });

  describe('getOrders', () => {
    it('should return an array of orders for the user', async () => {
      const userIdToTest = 123; // Example userId
      mockRequest.params.userId = userIdToTest; // Assuming controller gets userId from params for this route
      const expectedResponse: Order[] = [/* mock Order objects */];
      jest.spyOn(orderService, 'getOrders').mockResolvedValue(expectedResponse);

      // As per controller: getOrders(@Param('userId') userId: number): Promise<Order[]>
      // It does not use @Res(), so we check the return value.
      const result = await orderController.getOrders(userIdToTest);

      expect(orderService.getOrders).toHaveBeenCalledWith(userIdToTest);
      expect(result).toEqual(expectedResponse);
      // No mockResponse assertions as it's not used by this controller method
    });
  });

  describe('getOrderById', () => {
    it('should return a single order by aliasId', async () => {
      const aliasId = 'test-alias-id';
      mockRequest.params.aliasId = aliasId;
      const expectedResponse: Order = { aliasId } as Order; // Mock Order object
      jest.spyOn(orderService, 'getOrderById').mockResolvedValue(expectedResponse);

      await orderController.getOrderById(mockRequest, mockResponse);

      expect(orderService.getOrderById).toHaveBeenCalledWith(aliasId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Order details fetched successfully',
          data: expectedResponse,
        }),
      );
    });
  });

  describe('getOrderItems', () => {
    it('should return order items for a given order aliasId', async () => {
      const aliasId = 'test-alias-id';
      // mockRequest.params.aliasId = aliasId; // Controller uses @Param('aliasId')
      const expectedResponse: OrderItems[] = [/* mock OrderItems objects */];
      jest.spyOn(orderService, 'getOrderItems').mockResolvedValue(expectedResponse);

      // getOrderItems in controller uses @Param('aliasId') aliasId: string, @Res() response
      await orderController.getOrderItems(aliasId, mockResponse);

      expect(orderService.getOrderItems).toHaveBeenCalledWith(aliasId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Order items fetched successfully',
          data: expectedResponse,
        }),
      );
    });
  });

  describe('updateOrder', () => {
    it('should update an order successfully', async () => {
      const aliasId = 'test-alias-id';
      // mockRequest.params.aliasId = aliasId; // Controller uses @Param('aliasId')
      const updateOrderDto: UpdateOrderDto = {
        addressId: 1,
        orderItems: [{ productId: 1, price: 120, quantity: 2 }], // Removed duplicate productId
        orderStatus: 'Pending', // Added optional orderStatus for completeness in mock
      };
      const expectedResponse: CreateOrderResponseDto = { aliasId } as CreateOrderResponseDto;
      jest.spyOn(orderService, 'updateOrder').mockResolvedValue(expectedResponse);

      // updateOrder in controller uses @Param('aliasId') aliasId: string, @Body() order: UpdateOrderDto, @Res() response
      await orderController.updateOrder(aliasId, updateOrderDto, mockResponse);

      expect(orderService.updateOrder).toHaveBeenCalledWith(aliasId, updateOrderDto);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Order updated successfully',
          data: expectedResponse,
        }),
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order successfully', async () => {
      const aliasId = 'test-alias-id';
      // mockRequest.params.aliasId = aliasId; // Controller uses @Param('aliasId')
      const expectedResponse: Order = { aliasId, orderStatus: 'Cancelled' as any } as Order;
      jest.spyOn(orderService, 'cancelOrder').mockResolvedValue(expectedResponse);

      // As per controller: cancelOrder(@Param('aliasId') aliasId: string): Promise<Order>
      // It does not use @Res(), so we check the return value.
      const result = await orderController.cancelOrder(aliasId);

      expect(orderService.cancelOrder).toHaveBeenCalledWith(aliasId);
      expect(result).toEqual(expectedResponse);
      // No mockResponse assertions as it's not used by this controller method
    });
  });

  // Placeholder for health check if it exists in OrderController
  // describe('healthCheck', () => {
  //   it('should return OK for health check', () => {
  //     orderController.healthCheck(mockResponse);
  //     expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
  //     expect(mockResponse.send).toHaveBeenCalledWith('OK');
  //   });
  // });
});
