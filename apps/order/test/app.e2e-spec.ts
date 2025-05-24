import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { OrderModule } from '../src/order.module';
import { OrderRequestDto } from '../src/dto/create-order-req';
import { UpdateOrderDto } from '../src/dto/update-order-req.dto';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { initializeDatabase } from './util/test-db-setup.util';
import TestOrmConfigService from './orm.config.test';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { Address } from '@lib/address/src/entity/address.entity';
import { add } from 'winston';
import { CustomerAddress } from '@lib/address/src/entity/customerAdress.entity';
import { Customer } from '@app/auth/src/entity/customer.entity';
import { Product } from '@app/product/src/entity/product.entity';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let addressCreated: Address;
  let customerCreated: Customer;
  let productCreated: Product;
  let orderCreatedId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        OrderModule,
        TypeOrmModule.forRootAsync({
          useClass: TestOrmConfigService,
        })]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    await initializeDatabase(dataSource);
    customerCreated=await dataSource.getRepository(Customer).save({
      name: 'test',
      email: 'test@gmail.com',
      password: 'test',
    })
    addressCreated= await dataSource.getRepository(Address).save({
      street: '123 Main St',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      pincode: "12345",
    });
    productCreated= await dataSource.getRepository(Product).save({
      name: 'test',
      price: 50,
      stock: 100,
      sku: 'test-sku',
      description: 'test description',
      attributes:"test attributes",
    })
    console.log("addressCreated",addressCreated);
    await dataSource.getRepository(CustomerAddress).save({
      addressId: addressCreated.id,
      userId: 1,
    });
    
  });
  afterAll(async () => {
    await app.close();
  });
  let testAliasId = '';
  it("creates address",async ()=>{
      
  });
  it('/orders (POST)', () => {
    const createOrderDto: OrderRequestDto = {
      addressId: addressCreated.id, 
      orderItems: [
        {
          productId: 1,
          quantity: 2,
          price: 50,
        },
      ],
    };
    return request(app.getHttpServer())
      .post('/orders')
      .set('x-user-data', JSON.stringify(customerCreated))
      .send(createOrderDto)
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toHaveProperty('aliasId');
        const responsedata=res.body.data;
        testAliasId = responsedata.aliasId;
      });
  });

  it('/orders (POST) :- invalid addressId passed', () => {
    const createOrderDto: OrderRequestDto = {
      addressId: 9999,
      orderItems: [
        {
          productId: 1,
          quantity: 2,
          price: 50,
        },
      ],
    };
    return request(app.getHttpServer())
      .post('/orders')
      .set('x-user-data', JSON.stringify(customerCreated))
      .send(createOrderDto)
      .expect(400);
  });

  it('/orders (POST) :- invalid productId passed', () => {

    const createOrderDto: OrderRequestDto = {
      addressId: addressCreated.id,
      orderItems: [
        {
          productId: 9999,
          quantity: 2,
          price: 50,
        },
      ],
    };
    return request(app.getHttpServer())
      .post('/orders')
      .set('x-user-data', JSON.stringify(customerCreated))
      .send(createOrderDto)
      .expect(412);
  });

  it('/orders (POST) :- invalid quantity passed', () => {
    const createOrderDto: OrderRequestDto = {
      addressId: addressCreated.id,
      orderItems: [
        {
          productId: 1,
          quantity: 9999,
          price: 50,
        },
      ],
    };
    return request(app.getHttpServer())
      .post('/orders')
      .set('x-user-data', JSON.stringify(customerCreated))
      .send(createOrderDto)
      .expect(412);
  });

  it('/orders/:aliasId (GET)', () => {
    return request(app.getHttpServer())
      .get(`/orders/${testAliasId}`)
      .set('x-user-data', JSON.stringify({ id: 1 , name: 'test', email: 'test@gmail.com'}))
      .expect(200)
      .expect((res) => {
        let responsedata=res.body.data;
        expect(responsedata).toHaveProperty('id');
        expect(responsedata.aliasId).toEqual(testAliasId);
        orderCreatedId = responsedata.id;
      });
  });

  it('/orders/:aliasId (GET) :- invalid aliasId passed', () => {
    return request(app.getHttpServer())
      .get('/orders/test-alias-id')
      .expect(500);
  });

  it('/orders/:aliasId/orderItems (GET)', () => {
    return request(app.getHttpServer())
      .get(`/orders/${testAliasId}/orderItems`)
      .expect(200)
      .expect((res) => {
        const responsedata=res.body.data;
        expect(responsedata).toBeInstanceOf(Array);
        expect(responsedata.length).toEqual(1);
        expect(responsedata[0]).toMatchObject({
          productId: 1,
          quantity: 2,
          id:orderCreatedId
        })
      });
  });

  it('/orders/:aliasId (PUT)', () => {
    const updateOrderDto: UpdateOrderDto = {
      addressId: 1,
      orderStatus: 'Confirmed',
      orderItems: [
        {
          productId: 1,
          quantity: 3,
          price: 50,
        },
      ],
    };

    return request(app.getHttpServer())
      .put(`/orders/${testAliasId}`)
      .send(updateOrderDto)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveProperty('aliasId');
        const responsedata=res.body.data;
        expect(responsedata.aliasId).toEqual(testAliasId);
      });
  });

  it('/orders/:aliasId (DELETE) :- invalid string  passed', () => {
    return request(app.getHttpServer())
      .delete('/orders/test-alias-id')
      .expect(500);
  });
  it('/orders/:aliasId (DELETE) :- invalid orderId passed', () => {

    return request(app.getHttpServer())
      .delete('/orders/9999')
      .expect(404)
      .expect((res) => {
        expect(res.body.message).toEqual('Order not found');
      });
  });

  it('/orders/:aliasId (DELETE)', () => {
    return request(app.getHttpServer())
      .delete(`/orders/${orderCreatedId}`)
      .expect(204);
  });
});