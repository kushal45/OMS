import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class ResponseUtil {
  static success({
    response,
    message,
    data,
    statusCode = HttpStatus.OK
  }:{
    response: any,
    message: string,
    data?: unknown,
    statusCode: HttpStatus
  }) {
    response.status(statusCode).json({
      status: 'success',
      message,
      data,
    });
  }

  static error({
    response,
    message,
    error,
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR
  }:{
    response: any,
    message: string,
    error: unknown,
    statusCode: HttpStatus
  }) {
    response.status(statusCode).json({
      status: 'error',
      message,
      error,
    });
  }
}