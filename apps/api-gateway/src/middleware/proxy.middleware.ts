import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../guard/jwt.auth.guard';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggerService } from '@nestjs/common';
import { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as fs from 'fs';
import * as path from 'path';
import { cwd } from 'process';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  public serviceConfig: Record<string, string> = {};
  private context = ProxyMiddleware.name;
  constructor(
    @Inject(JwtAuthGuard) private readonly jwtAuthGuard: JwtAuthGuard,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {
    // Load config once at startup
    const configPath = path.resolve(__dirname, '../config/service-discovery.config.json');
    try {
      const configRaw = fs.readFileSync(configPath, 'utf-8');
      this.serviceConfig = JSON.parse(configRaw);
    } catch (err) {
      console.error('[ProxyMiddleware] Failed to load service discovery config:', err);
      this.serviceConfig = {};
    }
  }

  async use(req: Request, res: Response, next: () => void) {
    console.info(
      'Initial request fetched in proxy middleware baseUrl-->',
      req.baseUrl,
      'path-->',
      req.url,
      this.context
    );
    // Call JwtAuthGuard.canActivate for authentication
    let isAuthenticated = true;
    if (this.jwtAuthGuard && typeof this.jwtAuthGuard.canActivate === 'function') {
      try {
        // canActivate usually expects ExecutionContext, but for middleware, pass req as context
        isAuthenticated = await this.jwtAuthGuard.canActivate(req as any);
      } catch (err) {
        isAuthenticated = false;
      }
    }
    if (!isAuthenticated) {
      res.status(401).json({ message: 'Unauthorized Token' });
      return;
    }
    const target = this.determineTarget(req.path);
    if (!target) {
      console.error('[ProxyMiddleware] Missing target for request:', req.path);
      res.status(500).send('Proxy target not found');
      return;
    }
    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      on: {
        proxyReq: async (proxyReq, req, res) => {
          const user = (req as any).user;
          if (!res.headersSent && user) {
            proxyReq.setHeader('x-user-data', JSON.stringify(user));
          }
        },
        proxyRes: (proxyRes, req, res) => {
          console.log(
            '[ProxyMiddleware] Proxy response status:',
            proxyRes.statusCode,
            'response headers are:: ->',
            (req as any).user
          );
        },
        error: this.proxyErrorHandler.bind(this),
      },
    });
    proxy(req, res, next);
  }

  private proxyErrorHandler(err, req, res) {
    // DEBUG: Confirm error handler is called
    console.log('[ProxyMiddleware] DEBUG: error handler called', err.message);
    console.log('[ProxyMiddleware] DEBUG: this.logger value', this.logger);
    // Prefer injected logger for testability; fall back to console
    try {
      if (this.logger && typeof this.logger.error === 'function') {
        (this.logger as any).error('[ProxyMiddleware] Proxy error:', err.message);
      } else {
        console.error('[ProxyMiddleware] Proxy error:', err.message);
      }
    } catch (e) {
      console.error('[ProxyMiddleware] Proxy error:', err.message);
    }
  }

  private determineTarget(path: string): string {
    // Find the longest matching prefix in config
    if (!this.serviceConfig || Object.keys(this.serviceConfig).length === 0) {
      console.error('[ProxyMiddleware] Service configuration is empty or not loaded.');
      return '';
    }
    let matchedPrefix = '';
    for (const prefix of Object.keys(this.serviceConfig)) {
      if (path.startsWith(prefix) && prefix.length > matchedPrefix.length) {
        matchedPrefix = prefix;
      }
    }
    return matchedPrefix ? this.serviceConfig[matchedPrefix] : '';
  }
}
