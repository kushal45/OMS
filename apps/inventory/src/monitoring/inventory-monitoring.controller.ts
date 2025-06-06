import { Controller, Get, Res } from '@nestjs/common';
import { InventoryKafkaMetricsService } from './inventory-kafka-metrics.service';

@Controller('monitoring')
export class InventoryMonitoringController {
  constructor(private readonly metrics: InventoryKafkaMetricsService) {}

  @Get('kafka-metrics')
  async getKafkaMetrics(@Res() res) {
    res.set('Content-Type', 'text/plain');
    res.send(await this.metrics.getMetrics());
  }
}
