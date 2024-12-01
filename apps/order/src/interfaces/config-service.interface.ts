import { OrderConfig } from "./order-amtInfo.interface";

export interface ConfigService {
    getOrderConfig(): OrderConfig;
  }