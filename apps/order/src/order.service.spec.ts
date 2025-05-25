import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderService } from './order.service';
import { AddressService } from '../../../libs/address/src/address.service';
import { AddressRepository } from '../../../libs/address/src/repository/address.repository';
import { CustomerAddressRepository } from '../../../libs/address/src/repository/customerAddress.respository';
import { DefaultOrderConfigService } from './util/orderConfig.service';
import { TransactionService } from '@app/utils/transaction.service';
import { ServiceLocator } from './service-locator';
import { KafkaProducer } from '../../../libs/kafka/KafkaProducer';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../libs/logger/src';
import { ClientGrpc } from '@nestjs/microservices';
import { BadRequestException, NotFoundException } from '@nestjs/common'; // Added imports

import { Order, OrderStatus } from './entity/order.entity'; // Added OrderStatus
import { OrderItems } from './entity/orderItems.entity';
import { Address } from '../../../libs/address/src/entity/address.entity';
import { CustomerAddress } from '../../../libs/address/src/entity/customerAdress.entity';
import { Customer } from '@app/auth/src/entity/customer.entity';
import { Product } from '@app/product/src/entity/product.entity';
// Import centralized test utilities
import GlobalTestOrmConfigService from '../../../libs/test-utils/src/orm.config.test';
import { initializeDatabase } from '../../../libs/test-utils/src/test-db-setup.util';
import { OrderQueryInterface } from './interfaces/order-query-interface';
import { of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { CustomerRepository } from '@app/auth/src/repository/customer.repository';
import { ProductRepository } from '@app/product/src/repository/product.repository';
import { OrderItemsRepository } from './repository/orderItems.repository';
import { OrderRepository } from './repository/order.repository';

// Mocks
const mockInventoryService = {
  validate: jest.fn(),
};

const mockKafkaProducer = {
  send: jest.fn(),
  emit: jest.fn(),
};

const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('OrderService', () => {
  let service: OrderService;
  let dataSource: DataSource;
  let orderRepository: OrderRepository;
  let orderItemsRepository: OrderItemsRepository;
  let addressRepository: AddressRepository;
  let customerAddressRepository: CustomerAddressRepository;
  let customerRepository: CustomerRepository;
  let productRepository: ProductRepository;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useClass: GlobalTestOrmConfigService, // Use centralized config
          dataSourceFactory: async (options) => {
            const ds = new DataSource(options);
            return ds;
          },
        }),
        TypeOrmModule.forFeature([
          Order,
          OrderItems,
          Address,
          CustomerAddress,
          Customer,
          Product,
        ]),
      ],
      providers: [
        OrderService,
        AddressService, // Real AddressService
        DefaultOrderConfigService,
        TransactionService, // Real TransactionService
        { provide: LoggerService, useValue: mockLoggerService },
        {
          provide: 'INVENTORY_PACKAGE', // Assuming this is how ClientGrpc is injected for Inventory
          useValue: {
            getService: () => mockInventoryService,
          },
        },
        {
          provide: KafkaProducer,
          useValue: mockKafkaProducer,
        },
        {
          provide: ConfigService, // Mock ConfigService if OrderService uses it directly
          useValue: {
            get: jest.fn((key: string) => {
              // Provide mock config values as needed
              if (key === 'KAFKA_ORDER_CREATED_TOPIC') return 'order_created_topic';
              return null;
            }),
          },
          
        },
         {
        provide: getRepositoryToken(OrderRepository),
        useClass: OrderRepository,
      },
      {
        provide: getRepositoryToken(OrderItemsRepository),
        useClass: OrderItemsRepository,
      },
      {
        provide: getRepositoryToken(AddressRepository),
        useClass: AddressRepository,
      },
      {
        provide: getRepositoryToken(CustomerAddressRepository),
        useClass: CustomerAddressRepository,
      },
      {
        provide: getRepositoryToken(CustomerRepository),
        useClass: CustomerRepository,
      },
      {
        provide: getRepositoryToken(ProductRepository),
        useClass: ProductRepository,
      },
        // Provide actual repositories for AddressService if not already covered by TypeOrmModule.forFeature
        // This might be needed if AddressService is in a different module context in real app
        AddressRepository,
        CustomerAddressRepository,
        OrderRepository,
        OrderItemsRepository,
        ServiceLocator,
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    dataSource = module.get<DataSource>(DataSource);
   orderRepository = module.get<OrderRepository>(getRepositoryToken(OrderRepository));
  orderItemsRepository = module.get<OrderItemsRepository>(getRepositoryToken(OrderItemsRepository));
  addressRepository = module.get<AddressRepository>(getRepositoryToken(AddressRepository));
  customerAddressRepository = module.get<CustomerAddressRepository>(getRepositoryToken(CustomerAddressRepository));
  customerRepository = module.get<CustomerRepository>(getRepositoryToken(CustomerRepository));
  productRepository = module.get<ProductRepository>(getRepositoryToken(ProductRepository));
  });

  beforeEach(async () => {
    // Ensure a clean database for each test
    await initializeDatabase(dataSource);
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup default mock behaviors
    mockInventoryService.validate.mockReturnValue(
      of({
        success: true, // Corrected from isValid
        // invalidOrderItems should be undefined or empty if success is true
      } as OrderQueryInterface.ValidateOrderItemsResponse),
    );
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // More tests will be added here for createOrder, updateOrder, getOrderById etc.
  describe('createOrder', () => {
    let testCustomer: Customer;
    let testAddress: Address;
    let testProduct: Product;
    let customerAddress: CustomerAddress;

    beforeEach(async () => {
      // Seed common data
      testCustomer = await customerRepository.create({ email: 'test@example.com', name: 'Test User', password: 'password' });
      testAddress = await addressRepository.create({ street: '123 Test St', city: 'Testville', country: 'Testland', pincode: '12345', state: 'TestState' });
      customerAddress = await customerAddressRepository.create({  addressId: testAddress.id, userId: testCustomer.id });
      testProduct = await productRepository.create({ name: 'Test Product', price: 10.00, description: 'A test product', sku: 'test-sku', attributes: 'test attributes' });
    });

    it('should successfully create an order with valid data', async () => {
      const orderRequestDto = {
        addressId: testAddress.id,
        orderItems: [{ productId: testProduct.id, quantity: 2, price: testProduct.price }],
      };
      const userId = testCustomer.id;

      // Mock inventory validation to be successful
      mockInventoryService.validate.mockReturnValue(
        of({
          success: true, // Corrected from isValid
          // invalidOrderItems is undefined as all items are valid
        } as OrderQueryInterface.ValidateOrderItemsResponse),
      );
      
      const traceId = uuidv4(); // Generate a trace ID for logging
      const result = await service.createOrder(orderRequestDto, userId, traceId);

      expect(result).toBeDefined();
      expect(result.aliasId).toBeDefined(); // Changed from orderId to aliasId
      expect(result.orderStatus).toEqual(OrderStatus.Pending); // Or whatever initial status is
      expect(result.totalAmount).toBeGreaterThan(0);

      // Fetch order by aliasId
      const dbOrder = await orderRepository.findOne({ aliasId: result.aliasId });
      expect(dbOrder).toBeDefined();
      expect(dbOrder.userId).toEqual(userId);
      expect(dbOrder.addressId).toEqual(testAddress.id);

      // Fetch order items separately
      const dbOrderItems = await orderItemsRepository.findAll(dbOrder.id);
      expect(dbOrderItems.length).toBe(1);
      expect(dbOrderItems[0].productId).toEqual(testProduct.id);
      expect(dbOrderItems[0].quantity).toEqual(2);

      // Kafka event sending is currently commented out in OrderService.createOrder
      // If uncommented, add Kafka interaction assertions here.
    });

    it('should throw BadRequestException if address is invalid', async () => {
      const orderRequestDto = {
        addressId: 999, // Non-existent address
        orderItems: [{ productId: testProduct.id, quantity: 1, price: testProduct.price }],
      };
      const userId = testCustomer.id;

      // Mock AddressService to return false for isValidAddress
      // Note: This requires AddressService to be mockable or to ensure the test setup
      // correctly reflects an invalid address scenario for the real AddressService.
      // For simplicity here, we assume the real AddressService would lead to this.
      // If AddressService itself throws, the test should catch that specific error.
      // Based on OrderService code: if (!isValid) throw new BadRequestException('Address not valid');
      const traceId = uuidv4(); // Generate a trace ID for logging
      await expect(service.createOrder(orderRequestDto, userId, traceId)).rejects.toThrow(
        new BadRequestException('Address not valid'),
      );
    });
    
    it('should throw BadRequestException if inventory validation fails', async () => {
        const orderRequestDto = {
          addressId: testAddress.id,
          orderItems: [{ productId: testProduct.id, quantity: 100, price: testProduct.price }], // Assuming quantity 100 is too high
        };
        const userId = testCustomer.id;
  
        mockInventoryService.validate.mockReturnValue(
          of({
            success: false, // Corrected from isValid
            invalidOrderItems: [
              {
                orderItem: { productId: testProduct.id, quantity: 100, price: testProduct.price },
                reasons: ['Insufficient stock'],
              },
            ],
          } as OrderQueryInterface.ValidateOrderItemsResponse),
        );
  
        // Based on OrderService code: if (!validationResponse.success) { throw new BadRequestException(validationResponse.invalidOrderItems); }
        const traceId = uuidv4(); // Generate a trace ID for logging
        await expect(service.createOrder(orderRequestDto, userId, traceId)).rejects.toThrow(
          new BadRequestException([
            {
              orderItem: { productId: testProduct.id, quantity: 100, price: testProduct.price },
              reasons: ['Insufficient stock'],
            },
          ]),
        );
      });

    it('should throw BadRequestException if orderItems is empty', async () => {
      const orderRequestDto = {
        addressId: testAddress.id,
        orderItems: [], // Empty order items
      };
      const userId = testCustomer.id;
      const traceId = uuidv4(); // Generate a trace ID for logging
      await expect(service.createOrder(orderRequestDto, userId, traceId)).rejects.toThrow(
        new BadRequestException('Order items cannot be empty'),
      );
    });
  });

  describe('getOrderById', () => {
    let testCustomer: Customer;
    let createdOrder: Order;

    beforeEach(async () => {
      // Seed data
      testCustomer = await customerRepository.create({ email: 'customer@example.com', name: 'Order Getter', password: 'password' });
      const address = await addressRepository.create({ street: '456 Order St', city: 'Orderville', state: 'Orderstate', country: 'Orderland', pincode: '67890' });
      await customerAddressRepository.create({ addressId: address.id, userId: testCustomer.id });
      
      // Create a sample order directly using the repository for this test
      createdOrder = await orderRepository.create(
        await orderRepository.create({ // This creates an instance of Order
          userId: testCustomer.id,
          addressId: address.id,
          orderStatus: OrderStatus.Pending, // Corrected to use enum
          totalAmount: 100,
          deliveryCharge: 10,

          tax: 5,
        }), // Pass the created entity instance to save
      );
      // Assume OrderItems are created separately if needed for full order representation,
      // but getOrderById in OrderService might only return the Order entity itself.
    });

    it('should return an order if a valid aliasId is provided', async () => {
      const foundOrder = await service.getOrderById(createdOrder.aliasId);
      expect(foundOrder).toBeDefined();
      expect(foundOrder.id).toEqual(createdOrder.id);
      expect(foundOrder.aliasId).toEqual(createdOrder.aliasId);
      expect(foundOrder.userId).toEqual(testCustomer.id);
    });

    it('should throw NotFoundException if order with given aliasId does not exist', async () => {
      await expect(service.getOrderById(uuidv4())).rejects.toThrow(
        new NotFoundException('Order not found'),
      );
    });
  });

  describe('getOrders', () => {
    let testUser1: Customer;
    let testUser2: Customer;
    let addressUser1: Address;
    let order1: Order;
    let order2: Order;

    beforeEach(async () => {
      testUser1 = await customerRepository.create({ email: 'user1@example.com', name: 'User One', password: 'password' });
      testUser2 = await customerRepository.create({ email: 'user2@example.com', name: 'User Two', password: 'password' });
      addressUser1 = await addressRepository.create({ street: '789 User St', city: 'Userville', state: 'Stateville', country: 'Userland', pincode: '10112' }); // Used pincode, added state
      await customerAddressRepository.create({ userId: testUser1.id, addressId: addressUser1.id }); // Corrected to userId

      // Create two orders for testUser1
     order1= await orderRepository.create(
       {
          userId: testUser1.id,
          addressId: addressUser1.id,
          orderStatus: OrderStatus.Pending,
         deliveryCharge: 5,
          tax: 2,
          totalAmount: 50,
        }
      );
      order2 = await orderRepository.create(
       {
          userId: testUser1.id,
          addressId: addressUser1.id,
          orderStatus: OrderStatus.Confirmed,
          deliveryCharge: 5,
          tax: 2,
          totalAmount: 75,
        },
      );
    });

    it('should return all orders for a given userId', async () => {
      const orders = await service.getOrders(testUser1.id);
      expect(orders).toBeDefined();
      expect(orders.length).toBe(2);
      // Check if aliasIds match (or other distinct properties)
      const aliasIds = orders.map(o => o.aliasId);
      expect(aliasIds).toContain(order1.aliasId);
      expect(aliasIds).toContain(order2.aliasId);
    });

    it('should return an empty array if the user has no orders', async () => {
      const orders = await service.getOrders(testUser2.id);
      expect(orders).toBeDefined();
      expect(orders.length).toBe(0);
    });

    it('should return an empty array for a non-existent userId', async () => {
      const nonExistentUserId = 99999;
      const orders = await service.getOrders(nonExistentUserId);
      expect(orders).toBeDefined();
      expect(orders.length).toBe(0);
    });
  });

  describe('getOrderItems', () => {
    let testCustomer: Customer;
    let testOrder: Order;
    let testProduct1: Product;
    let testProduct2: Product;
    let order: Order;

    beforeEach(async () => {
      testCustomer = await customerRepository.create({ email: 'itemuser@example.com', name: 'Item User', password: 'password' });
      const address = await addressRepository.create({ street: '111 Item St', city: 'Itemville', state: 'ItemState', country: 'Itemland', pincode: '12134' });
      await customerAddressRepository.create({ userId: testCustomer.id, addressId: address.id });

      testOrder = await orderRepository.create(
        order=await orderRepository.create({
          userId: testCustomer.id,
          addressId: address.id,
          orderStatus: OrderStatus.Confirmed,
          totalAmount: 250,
          deliveryCharge: 10,
          tax: 5,
        }),
      );

      testProduct1 = await productRepository.create({ name: 'Item Product 1', price: 50, description: 'Desc 1',sku: 'item-product-1', attributes: 'test attributes 1' });
      testProduct2 = await productRepository.create({ name: 'Item Product 2', price: 100, description: 'Desc 2' , sku: 'item-product-2', attributes: 'test attributes 2' });

      // Create order items for testOrder
      await orderItemsRepository.createMany({
        orderId: testOrder.id,
        orderItems: [
          { productId: testProduct1.id, quantity: 2, price: testProduct1.price },
          { productId: testProduct2.id, quantity: 1, price: testProduct2.price },
        ],
      });
    });

    it('should return order items for a valid order aliasId', async () => {
      const items = await service.getOrderItems(testOrder.aliasId);
      expect(items).toBeDefined();
    });

    it('should return order items for a valid order aliasId', async () => {
      const items = await service.getOrderItems(testOrder.aliasId);
      expect(items).toBeDefined();
      expect(items.length).toBe(2);
      
      const productIdsInItems = items.map(item => item.productId);
      expect(productIdsInItems).toContain(testProduct1.id);
      expect(productIdsInItems).toContain(testProduct2.id);

      const item1 = items.find(item => item.productId === testProduct1.id);
      expect(item1.quantity).toBe(2);
      const item2 = items.find(item => item.productId === testProduct2.id);
      expect(item2.quantity).toBe(1);
    });

    it('should throw NotFoundException if order with given aliasId does not exist in the order Items', async () => {
      await expect(service.getOrderItems(uuidv4())).rejects.toThrow(
        new NotFoundException('Order not found'),
      );
    });

    it('should return an empty array if an order exists but has no items', async () => {
      const orderWithoutItems = await 
        orderRepository.create({
          userId: testCustomer.id,
          addressId: (await addressRepository.findByAttributes({ city: 'Itemville' }))[0].id, // Re-use address
          orderStatus: OrderStatus.Pending,
          totalAmount: 0,
          deliveryCharge: 0,
          tax: 0
        });
      const items = await service.getOrderItems(orderWithoutItems.aliasId);
      expect(items).toBeDefined();
      expect(items.length).toBe(0);
    });
  });
});