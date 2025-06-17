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
    this.logger.debug(
      JSON.stringify({
        message: 'Response caught in interceptor',
        handler,
        args: this.safeStringify(args),
      }),
      LoggerErrorInterceptor.name,
    );
    return next.handle().pipe(
      tap({
        next: (response) => {
          console.log('response intercepted');
        },
        error: (err) => {
          // Robust error extraction
          const status =
            err?.status ?? err?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = err?.message || 'Internal server error';
          const stack =
            err?.stack || (typeof err === 'object' ? JSON.stringify(err) : String(err));

          // Log full error details
          this.logger.error(
            `Error caught in interceptor: ${message}\nStatus: ${status}\nStack: ${stack}`,
            LoggerErrorInterceptor.name,
          );
          this.logError(req, err);

          // Always send a proper error response
          ResponseUtil.error({
            response,
            message,
            error: message,
            statusCode: status,
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
      message: `Message: ${error?.message || error} | Stack: ${error?.stack || ''}`,
      context: 'ExceptionHandler',
      method: req?.method,
      url: req?.url,
      body: req?.body,
      error: typeof error === 'object' ? error : String(error),
    };
    this.logger.error(JSON.stringify(logMessage), 'intercept');
  }
}
