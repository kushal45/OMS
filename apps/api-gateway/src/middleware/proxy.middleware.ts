import { HttpService } from '@nestjs/axios';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { JwtAuthGuard } from '../guard/jwt.auth.guard';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private AUTH_SERVICE_URL = 'http://auth:3001';
  private ORDER_SERVICE_URL = 'http://order:3002';

  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
    private reflector: Reflector,
    private httpService: HttpService,
  ) {}

  use(req: Request, res: Response, next: () => void) {
    console.log(
      'Initial request fetched in proxy middleware  baseUrl-->',
      req.baseUrl,
      'path-->',
      req.url,
    );
    const target = this.determineTarget(req.path);
    console.log(
      '[ProxyMiddleware] Proxying request to:',
      target ? 'Auth Service' : 'Order Service',
    );
    if (!target) {
      console.error('[ProxyMiddleware] Missing target for request:', req.path);
      res.status(500).send('Proxy target not found');
      return;
    }
    const pathReq = req.baseUrl;
    console.log('[ProxyMiddleware] Proxying request to path:', pathReq);
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
          console.log(
            '[ProxyMiddleware] Proxy request headers:',
            proxyReq.getHeaders(),
          );
          console.log('[ProxyMiddleware] Proxy request path:', req.url);
          console.log('[ProxyMiddleware] Proxy request method:', req.method);
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
