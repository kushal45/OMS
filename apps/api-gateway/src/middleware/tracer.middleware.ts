import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TracerMiddleWare implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Generate a correlation ID if it doesn't exist
    console.log("request headers",req.headers);
    const correlationId = req.headers['x-correlation-id'] || uuidv4();

    // Attach the correlation ID to the request object
    req.headers['x-correlation-id'] = correlationId;

    // Add the correlation ID to the response headers
    res.setHeader('x-correlation-id', correlationId);

    // Log the correlation ID along with the request details
    console.log(
      `Correlation ID: ${correlationId} - ${req.method} ${req.originalUrl}`,
    );
    next();
  }
}
