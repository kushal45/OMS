import { Controller, Get } from '@nestjs/common';
import { ApiGatewayService } from './api-gateway.service';

@Controller()
export class ApiGatewayController {
  constructor() {}

  @Get()
  getHello(): void {
   // return this.apiGatewayService.getHello();
  }
}
