import { ValidationPipe, ValidationError, BadRequestException } from '@nestjs/common';

export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super();
    this.exceptionFactory = (errors: ValidationError[]): BadRequestException => {
      const formattedErrors = errors.map(error => {
        return {
          property: error.property,
          constraints: error.constraints,
          children: error.children,
        };
      });
      console.log('formattedErrors', formattedErrors);
      return new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    };
  }
}