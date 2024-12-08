import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CustomLoggerService } from '../logger.service';
import { ResponseUtil } from '@app/utils/response.util';

@Injectable()
export class LoggerErrorInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    return next.handle().pipe(
        tap({
            next: (response) => {
              console.log("response intercepted");
            },
            error: (err) => {
              console.log('Error caught in interceptor', err.status); // Debug statement
              this.logError(req, err);
              ResponseUtil.error({
                response,
                message: err.message,
                error: err.response?? err.message,
                statusCode:err.status?? HttpStatus.INTERNAL_SERVER_ERROR as HttpStatus
              })
            },
          }),
    );
  }

  private logError(req: any, error: any) {
    const logMessage = {
        message: `Message: ${error.message}, Stack: ${error.stack}`,
        context: 'ExceptionHandler',
        method: req.method,
        url: req.url,
        body: req.body,
        error:JSON.stringify(error),
      };

      // Serialize logMessage.message to ensure it's plain text
      logMessage.message = JSON.stringify(logMessage.message);
      this.logger.error(logMessage,"intercept");
  }
}
