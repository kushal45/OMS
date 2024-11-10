import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule,{ bodyParser: false });
  //const globalPrefix = 'api';
  //app.setGlobalPrefix(globalPrefix);
  const AUTH_SERVICE_URL = 'http://auth:3001';
  const ORDER_SERVICE_URL = 'http://order:3002';
  // app.use(
  //   '/api/at',
  //   createProxyMiddleware({
  //     target: AUTH_SERVICE_URL,
  //     changeOrigin: true,
  //     on:{
  //       proxyReq: (proxyReq, req, res) => {
  //         console.log(
  //           '[ProxyMiddleware] Proxy request headers:',
  //           proxyReq.getHeaders(),
  //         );
  //         console.log('[ProxyMiddleware] Proxy request path main.ts -> :', req.url);
  //       },
  //       proxyRes: (proxyRes, req, res) => {
  //         console.log('[ProxyMiddleware] Proxying response from:',res.statusCode);
  //       },
  //       error: (err, req, res) => {
  //         console.error('[ProxyMiddleware] Proxy error:', err);
  //       },
  //     }
  //   }),
  // );
  // app.use(
  //   '/api/or',
  //   createProxyMiddleware({
  //     target: ORDER_SERVICE_URL,
  //     changeOrigin: true,
  //     on:{
  //       proxyReq: (proxyReq, req, res) => {
  //         console.log(
  //           '[ProxyMiddleware] Proxy request headers:',
  //           proxyReq.getHeaders(),
  //         );
  //         console.log('[ProxyMiddleware] Proxy request path:', req.url);
  //       },
  //       proxyRes: (proxyRes, req, res) => {
  //         console.log('[ProxyMiddleware] Proxying response from:',proxyRes);
  //       },
  //       error: (err, req, res) => {
  //         console.error('[ProxyMiddleware] Proxy error:', err);
  //       },
  //     }
  //   }),
  // );
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
