import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../logger.service';
import { ResponseUtil } from '@app/utils/response.util';

@Injectable()
export class LoggerErrorInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const handler = context.getHandler().name;
    const args = context.getArgs();
    this.logger.info(
      {
        message: 'Response caught in interceptor',
        handler,
        args: this.safeStringify(args),
      },
      LoggerErrorInterceptor.name,
    );
    return next.handle().pipe(
      tap({
        next: (response) => {
          console.log('response intercepted');
        },
        error: (err) => {
          console.log('Error caught in interceptor', err.status); // Debug statement
          this.logError(req, err);
          ResponseUtil.error({
            response,
            message: err.message,
            error: err.message,
            statusCode:
              err.status ?? (HttpStatus.INTERNAL_SERVER_ERROR as HttpStatus),
          });
        },
      }),
    );
  }

  private safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  }

  private logError(req: any, error: any) {
    const logMessage = {
      message: `Message: ${error.message}, Stack: ${error.stack}`,
      context: 'ExceptionHandler',
      method: req.method,
      url: req.url,
      body: req.body,
    };

    // Serialize logMessage.message to ensure it's plain text
    this.logger.error(JSON.stringify(logMessage.message), 'intercept');
  }
}
