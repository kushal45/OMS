import { Inject, Injectable, LoggerService, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private AUTH_SERVICE_URL = 'http://auth:3001';
  private ORDER_SERVICE_URL = 'http://order:3002';
  private context = ProxyMiddleware.name;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
  ) {}

  use(req: Request, res: Response, next: () => void) {
    this.logger.log(
      'Initial request fetched in proxy middleware  baseUrl-->',
      req.baseUrl,
      'path-->',
      req.url,
      this.context
    );
    const target = this.determineTarget(req.path);
    if (!target) {
      this.logger.error('[ProxyMiddleware] Missing target for request:', req.path);
      res.status(500).send('Proxy target not found');
      return;
    }
    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      on: {
        proxyReq: async (proxyReq, req, res) => {
          console.log("request user is:: ->",(req as any ).user);
          const user = (req as any).user;
          console.log("res.headersSent is:: ->",res.headersSent);
          if(!res.headersSent && user){
            proxyReq.setHeader('x-user-data', JSON.stringify(user));
          }
        },
        proxyRes: (proxyRes, req, res) => {
          console.log(
            '[ProxyMiddleware] Proxy response status:',
            proxyRes.statusCode,
            "response headers are:: ->",
            (req as any ).user
          );
        },
        error: (err, req, res) => {
          console.error('[ProxyMiddleware] Proxy error:', err.message);
        },
      },
    });
    proxy(req, res, next);
  }

  private determineTarget(path:string): string {
    if (path.startsWith('/auth')) {
      return this.AUTH_SERVICE_URL; // service1
    }
    if (path.startsWith('/order')) {
      return this.ORDER_SERVICE_URL; // service2
    }
    return '';
  }
}
