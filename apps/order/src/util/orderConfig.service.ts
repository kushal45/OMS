import { ConfigService } from "../interfaces/config-service.interface";
import { OrderConfig } from "../interfaces/order-amtInfo.interface";

export class DefaultOrderConfigService implements ConfigService {
    getOrderConfig(): OrderConfig {
      return {
        taxRate: parseFloat(process.env.TAX_RATE || '10'),
        deliveryCharge: parseFloat(process.env.DELIVERY_CHARGE || '50'),
        deliveryChargeThreshold: parseFloat(process.env.DELIVERY_CHARGE_THRESHOLD || '500'),
      };
    }
  }