import { LoggerService } from '@lib/logger/src/logger.service';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
        
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message || 'Internal server error',
      correlationId: request.headers['x-correlation-id'] || 'unknown',
    };
    
    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      exception.stack,
      'GlobalExceptionFilter'
    );
    
    response.status(status).json(errorResponse);
  }
}