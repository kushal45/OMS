import { ConfigService as AppConfigService } from "../interfaces/config-service.interface";
import { OrderConfig } from "../interfaces/order-amtInfo.interface";
import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable() // Make it injectable
export class DefaultOrderConfigService implements AppConfigService {
    constructor(private nestConfigService: NestConfigService) {} // Inject NestConfigService

    getOrderConfig(): OrderConfig {
      // Ensure that TAX_RATE, DELIVERY_CHARGE, DELIVERY_CHARGE_THRESHOLD are defined in the .env file
      // or provided in the environment.
      // ConfigService.get will return undefined if the key is not found and no default is provided.
      // parseFloat(undefined) is NaN. Consider adding checks or more robust defaults if needed.
      const taxRate = parseFloat(this.nestConfigService.get<string>('TAX_RATE'));
      const deliveryCharge = parseFloat(this.nestConfigService.get<string>('DELIVERY_CHARGE'));
      const deliveryChargeThreshold = parseFloat(this.nestConfigService.get<string>('DELIVERY_CHARGE_THRESHOLD'));

      return {
        taxRate: isNaN(taxRate) ? 0 : taxRate, // Default to 0 if not found or invalid
        deliveryCharge: isNaN(deliveryCharge) ? 0 : deliveryCharge, // Default to 0
        deliveryChargeThreshold: isNaN(deliveryChargeThreshold) ? 0 : deliveryChargeThreshold, // Default to 0
      };
    }
  }