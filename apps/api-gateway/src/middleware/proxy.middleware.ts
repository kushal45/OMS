import { Inject, Injectable, LoggerService, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { JwtAuthGuard } from '../guard/jwt.auth.guard';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private AUTH_SERVICE_URL = 'http://auth:3001';
  private ORDER_SERVICE_URL = 'http://order:3002';
  private context = ProxyMiddleware.name;

  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
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
    const pathReq = req.baseUrl;
    this.logger.log('[ProxyMiddleware] Proxying request to path:', pathReq);
    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      on: {
        proxyReq: async (proxyReq, req, res) => {
          const canActivate = await this.jwtAuthGuard.canActivate({
            switchToHttp: () => ({
              getRequest: () => req,
            }),
          } as any);
          if (!canActivate) {
            console.error('[ProxyMiddleware] Unauthorized request:', req.url);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Unauthorized Token' }));
          }
        },
        proxyRes: (proxyRes, req, res) => {
          console.log(
            '[ProxyMiddleware] Proxy response status:',
            proxyRes.statusCode,
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
