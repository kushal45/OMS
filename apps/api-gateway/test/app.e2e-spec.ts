import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiGatewayModule } from '../src/api-gateway.module';

describe('ApiGatewayController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [ApiGatewayModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should register a user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('should login a user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
  });

  afterAll(async () => {
    await app.close();
  });
});
