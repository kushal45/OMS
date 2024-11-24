import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response, NextFunction } from 'express';
import { ProxyMiddleware } from './proxy.middleware';
import { JwtAuthGuard } from '../guard/jwt.auth.guard';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { LoggerService } from '@nestjs/common';

jest.mock('http-proxy-middleware', () => ({
    createProxyMiddleware: jest
      .fn()
      .mockReturnValue((req, res, next) => next()),
  }));

  jest.mock('../guard/jwt.auth.guard', () => {
    return {
      JwtAuthGuard: jest.fn().mockImplementation(() => ({
        canActivate: jest.fn().mockResolvedValue(true),
      })),
    };
  });

describe('ProxyMiddleware', () => {
  describe('Peripheral Testing', () => {
    

    let proxyMiddleware: ProxyMiddleware;
    let jwtAuthGuard: JwtAuthGuard;
    let logger: LoggerService;
    beforeEach(async () => {
      const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProxyMiddleware,
          JwtAuthGuard,
          {
            provide: WINSTON_MODULE_NEST_PROVIDER,
            useValue: mockLogger,
          },
        ],
      }).compile();

      proxyMiddleware = module.get<ProxyMiddleware>(ProxyMiddleware);
      jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
      logger = module.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
    });

    it('should proxy request to Auth service', async () => {
      const req = {
        baseUrl: '',
        path: '/auth/login',
        headers: {},
        url: '/auth/login',
        method: 'GET',
      } as Request;
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      jest.spyOn(jwtAuthGuard, 'canActivate').mockResolvedValue(true);

      await proxyMiddleware.use(req, res, next);

      expect(createProxyMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'http://auth:3001',
        }),
      );
      expect(next).toHaveBeenCalled();
    });

    it('should proxy request to Order service', async () => {
      const req = {
        baseUrl: '',
        path: '/order/create',
        headers: {},
        url: '/order/create',
        method: 'POST',
      } as Request;
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      jest.spyOn(jwtAuthGuard, 'canActivate').mockResolvedValue(false);

      await proxyMiddleware.use(req, res, next);

      expect(createProxyMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'http://order:3002',
        }),
      );
      expect(next).toHaveBeenCalled();
    });

    it('should return 500 if target is missing', async () => {
      const req = {
        baseUrl: '',
        path: '/unknown',
        headers: {},
        url: '/unknown',
        method: 'GET',
      } as Request;
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await proxyMiddleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Proxy target not found');
    });
  });

  describe('internal testing of proxy middleware', () => {
    let proxyMiddleware: ProxyMiddleware;
    let jwtAuthGuard: JwtAuthGuard;
    let logger: LoggerService;

    
    beforeEach(async () => {
      const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProxyMiddleware,
          JwtAuthGuard,
          {
            provide: WINSTON_MODULE_NEST_PROVIDER,
            useValue: mockLogger,
          },
        ],
      }).compile();

      proxyMiddleware = module.get<ProxyMiddleware>(ProxyMiddleware);
      jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
      logger = module.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
    });
    it('should return 401 if JWT authentication fails', async () => {
      const req = {
        baseUrl: '',
        path: '/auth/login',
        headers: {},
        url: '/auth/login',
        method: 'GET',
      } as Request;
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        writeHead: jest.fn(),
        end: jest.fn(),
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      jest.spyOn(jwtAuthGuard, 'canActivate').mockResolvedValue(false);
      const proxtReq = jest.fn();
      (createProxyMiddleware as jest.Mock).mockImplementationOnce((options) => {
        options.on.proxyReq(proxtReq, req, res);
        return (req, res, next) => next();
      });

      await proxyMiddleware.use(req, res, next);

      expect(res.writeHead).toHaveBeenCalledWith(401, {
        'Content-Type': 'application/json',
      });
      expect(res.end).toHaveBeenCalledWith(
        JSON.stringify({ message: 'Unauthorized Token' }),
      );
    });

    it('should log proxy errors', async () => {
      const req = {
        baseUrl: '',
        path: '/auth/login',
        headers: {},
        url: '/auth/login',
        method: 'GET',
      } as Request;
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      const proxyError = new Error('Proxy error');
      jest.spyOn(jwtAuthGuard, 'canActivate').mockResolvedValue(true);
      jest.spyOn(console, 'error').mockImplementation(() => {});

      (createProxyMiddleware as jest.Mock).mockImplementationOnce((options) => {
        options.on.error(proxyError, req, res);
        return (req, res, next) => next();
      });

      await proxyMiddleware.use(req, res, next);

      expect(console.error).toHaveBeenCalledWith('[ProxyMiddleware] Proxy error:', 'Proxy error');
    });
  });
});
