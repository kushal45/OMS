import { Injectable } from '@nestjs/common';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  service?: string;
  method?: string;
  url?: string;
  [key: string]: any;
}

export interface ErrorContext extends LogContext {
  errorCode?: string;
  stackTrace?: string;
}

@Injectable()
export class DebugLogger {
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  private static getCorrelationId(req?: any): string {
    return req?.headers?.['x-correlation-id'] || 
           req?.correlationId || 
           `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private static sanitizeHeaders(headers: any): any {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    
    // Remove sensitive information
    const sensitiveKeys = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    });
    
    return sanitized;
  }

  private static sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });
    
    return sanitized;
  }

  static logRequest(req: any, context: LogContext = {}): string {
    const correlationId = this.getCorrelationId(req);
    const timestamp = this.getTimestamp();
    
    const logData = {
      timestamp,
      correlationId,
      type: 'REQUEST',
      service: context.service || process.env.SERVICE_NAME || 'unknown',
      method: req.method,
      url: req.url || req.originalUrl,
      path: req.path,
      headers: this.sanitizeHeaders(req.headers),
      body: this.sanitizeBody(req.body),
      params: req.params,
      query: req.query,
      userAgent: req.headers?.['user-agent'],
      ip: req.ip || req.connection?.remoteAddress,
      ...context
    };

    console.log(`[${timestamp}] [${correlationId}] [REQUEST] ${req.method} ${req.url}`, 
                JSON.stringify(logData, null, 2));
    
    return correlationId;
  }

  static logResponse(res: any, data: any, context: LogContext = {}): void {
    const timestamp = this.getTimestamp();
    const correlationId = context.correlationId || this.getCorrelationId();
    
    const logData = {
      timestamp,
      correlationId,
      type: 'RESPONSE',
      service: context.service || process.env.SERVICE_NAME || 'unknown',
      statusCode: res.statusCode,
      responseTime: context.responseTime,
      dataSize: JSON.stringify(data).length,
      data: data,
      ...context
    };

    console.log(`[${timestamp}] [${correlationId}] [RESPONSE] ${res.statusCode}`, 
                JSON.stringify(logData, null, 2));
  }

  static logError(error: any, context: ErrorContext = {}): void {
    const timestamp = this.getTimestamp();
    const correlationId = context.correlationId || this.getCorrelationId();
    
    const logData = {
      timestamp,
      correlationId,
      type: 'ERROR',
      service: context.service || process.env.SERVICE_NAME || 'unknown',
      errorName: error.name,
      errorMessage: error.message,
      errorCode: context.errorCode || error.code,
      statusCode: error.status || error.statusCode,
      stackTrace: error.stack,
      ...context
    };

    console.error(`[${timestamp}] [${correlationId}] [ERROR] ${error.message}`, 
                  JSON.stringify(logData, null, 2));
  }

  static logInfo(message: string, data: any = {}, context: LogContext = {}): void {
    const timestamp = this.getTimestamp();
    const correlationId = context.correlationId || this.getCorrelationId();
    
    const logData = {
      timestamp,
      correlationId,
      type: 'INFO',
      service: context.service || process.env.SERVICE_NAME || 'unknown',
      message,
      data,
      ...context
    };

    console.log(`[${timestamp}] [${correlationId}] [INFO] ${message}`, 
                JSON.stringify(logData, null, 2));
  }

  static logWarning(message: string, data: any = {}, context: LogContext = {}): void {
    const timestamp = this.getTimestamp();
    const correlationId = context.correlationId || this.getCorrelationId();
    
    const logData = {
      timestamp,
      correlationId,
      type: 'WARNING',
      service: context.service || process.env.SERVICE_NAME || 'unknown',
      message,
      data,
      ...context
    };

    console.warn(`[${timestamp}] [${correlationId}] [WARNING] ${message}`, 
                 JSON.stringify(logData, null, 2));
  }

  static logDebug(message: string, data: any = {}, context: LogContext = {}): void {
    // Only log debug messages in development or when DEBUG is enabled
    if (process.env.NODE_ENV === 'production' && !process.env.DEBUG) {
      return;
    }

    const timestamp = this.getTimestamp();
    const correlationId = context.correlationId || this.getCorrelationId();
    
    const logData = {
      timestamp,
      correlationId,
      type: 'DEBUG',
      service: context.service || process.env.SERVICE_NAME || 'unknown',
      message,
      data,
      ...context
    };

    console.debug(`[${timestamp}] [${correlationId}] [DEBUG] ${message}`, 
                  JSON.stringify(logData, null, 2));
  }

  static logDatabaseQuery(query: string, params: any[] = [], context: LogContext = {}): void {
    const timestamp = this.getTimestamp();
    const correlationId = context.correlationId || this.getCorrelationId();
    
    const logData = {
      timestamp,
      correlationId,
      type: 'DATABASE_QUERY',
      service: context.service || process.env.SERVICE_NAME || 'unknown',
      query,
      params,
      ...context
    };

    console.log(`[${timestamp}] [${correlationId}] [DB_QUERY]`, 
                JSON.stringify(logData, null, 2));
  }

  static logExternalCall(url: string, method: string, response: any, context: LogContext = {}): void {
    const timestamp = this.getTimestamp();
    const correlationId = context.correlationId || this.getCorrelationId();
    
    const logData = {
      timestamp,
      correlationId,
      type: 'EXTERNAL_CALL',
      service: context.service || process.env.SERVICE_NAME || 'unknown',
      url,
      method,
      responseStatus: response.status,
      responseTime: context.responseTime,
      ...context
    };

    console.log(`[${timestamp}] [${correlationId}] [EXTERNAL_CALL] ${method} ${url}`, 
                JSON.stringify(logData, null, 2));
  }

  static createRequestMiddleware(serviceName: string) {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const correlationId = this.logRequest(req, { service: serviceName });
      
      // Add correlation ID to request for downstream use
      req.correlationId = correlationId;
      
      // Override res.json to log response
      const originalJson = res.json;
      res.json = function(data: any) {
        const responseTime = Date.now() - startTime;
        DebugLogger.logResponse(res, data, { 
          correlationId, 
          service: serviceName, 
          responseTime: `${responseTime}ms` 
        });
        return originalJson.call(this, data);
      };
      
      next();
    };
  }

  static createErrorHandler(serviceName: string) {
    return (error: any, req: any, res: any, next: any) => {
      this.logError(error, {
        correlationId: req.correlationId,
        service: serviceName,
        method: req.method,
        url: req.url,
        userId: req.user?.id
      });
      
      next(error);
    };
  }
}

// Export utility functions for quick access
export const logRequest = DebugLogger.logRequest.bind(DebugLogger);
export const logResponse = DebugLogger.logResponse.bind(DebugLogger);
export const logError = DebugLogger.logError.bind(DebugLogger);
export const logInfo = DebugLogger.logInfo.bind(DebugLogger);
export const logWarning = DebugLogger.logWarning.bind(DebugLogger);
export const logDebug = DebugLogger.logDebug.bind(DebugLogger);
export const logDatabaseQuery = DebugLogger.logDatabaseQuery.bind(DebugLogger);
export const logExternalCall = DebugLogger.logExternalCall.bind(DebugLogger);
