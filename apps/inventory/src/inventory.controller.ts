import { Controller, Get, Post, Put, Delete, Body, Param, Res, HttpStatus, Inject } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger'; // Added ApiParam import
import { InventoryService } from './inventory.service';
import { Inventory } from './entity/inventory.entity';
import { ResponseUtil } from '@app/utils/response.util';
import { ConfigService } from '@nestjs/config';
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { GrpcMethod } from '@nestjs/microservices';
import { LoggerService } from '@lib/logger/src';
import { ModuleRef } from '@nestjs/core';
import { ValidateInventoryReq, ValidateInventoryRes, ReserveInventoryReq, ReserveInventoryRes, ReleaseInventoryReq, ReleaseInventoryRes } from './proto/inventory';

@Controller('inventories')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(KafkaAdminClient) private readonly kafkaAdminClient: KafkaAdminClient,
    @Inject("KafkaConsumerInstance") private readonly kafkaConsumer: KafkaConsumer,
    private readonly logger: LoggerService,
    private moduleRef: ModuleRef
  ) {}

  @Post()
  async createInventory(@Body() inventory: Partial<Inventory>, @Res() response) {
    ResponseUtil.success({
      response,
      message: 'Inventory created successfully',
      data: await this.inventoryService.createInventory(inventory),
      statusCode:HttpStatus.CREATED
    });
  }

  async onModuleInit() {
    // Ensure topic exists (admin client)
    await this.kafkaAdminClient.createTopic(this.configService.get<string>('RESERVE_INVENTORY_TOPIC'));
    await this.kafkaAdminClient.createTopic(this.configService.get<string>('RELEASE_INVENTORY_TOPIC'));
    await this.kafkaAdminClient.createTopic(this.configService.get<string>('REPLENISH_INVENTORY_TOPIC')); // New topic
    // Add delay to allow topic propagation across brokers
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds delay
    // Do NOT subscribe here! All subscriptions are now handled in the service for idempotency.
    // await this.kafkaConsumer.subscribe(this.configService.get<string>('INVENTORY_UPDATE_TOPIC'));
    // await this.inventoryService.eventBasedUpdate(this.kafkaConsumer);
  }

  @Get()
  async getInventories(@Res() response) {
    ResponseUtil.success({
      response,
      message: 'Successfully fetched inventories',
      data: await this.inventoryService.getInventories(),
      statusCode:HttpStatus.OK
    })
  }

  @GrpcMethod('InventoryService','validate')
  async validate(data: ValidateInventoryReq): Promise<ValidateInventoryRes> {
    try {
      const validationResponse = await this.inventoryService.validate(data);
      this.logger.debug(`InventoryService.validate response: ${JSON.stringify(validationResponse)}`, 'InventoryService.validate');
      return validationResponse;
    } catch (error) {
        this.logger.error(`Error in InventoryService.validate: ${error.message}`, error.stack, 'InventoryService.validate');
        throw error; // Let gRPC handle the error propagation
    }
  }

  @GrpcMethod('InventoryService', 'reserveInventory')
  async reserveInventory(data: ReserveInventoryReq): Promise<ReserveInventoryRes> {
    try {
      this.logger.info(`InventoryService.reserveInventory request: ${JSON.stringify(data)}`, 'InventoryService.reserveInventory');
      const response = await this.inventoryService.reserveInventory(data);
      this.logger.info(`InventoryService.reserveInventory response: ${JSON.stringify(response)}`, 'InventoryService.reserveInventory');
      return response;
    } catch (error) {
      this.logger.error(`Error in InventoryService.reserveInventory: ${error.message}`, error.stack, 'InventoryService.reserveInventory');
      throw error;
    }
  }

  @GrpcMethod('InventoryService', 'releaseInventory')
  async releaseInventory(data: ReleaseInventoryReq): Promise<ReleaseInventoryRes> {
    try {
      this.logger.info(`InventoryService.releaseInventory request: ${JSON.stringify(data)}`, 'InventoryService.releaseInventory');
      const response = await this.inventoryService.releaseInventory(data);
      this.logger.info(`InventoryService.releaseInventory response: ${JSON.stringify(response)}`, 'InventoryService.releaseInventory');
      return response;
    } catch (error) {
      this.logger.error(`Error in InventoryService.releaseInventory: ${error.message}`, error.stack, 'InventoryService.releaseInventory');
      throw error;
    }
  }

  @Get(':productId') // Changed param name for clarity
  @ApiParam({ name: 'productId', type: String, description: 'Product ID (number)' })
  async getInventoryByProductId(@Param('productId') productId: string, @Res() response) {
    ResponseUtil.success({
      response,
      message: 'Successfully fetched inventory',
      data: await this.inventoryService.fetch(productId),
      statusCode:HttpStatus.OK
    })
  }

  @Put(':productId') // Changed param name
  @ApiParam({ name: 'productId', type: String, description: 'Product ID (number)' })
  async updateInventory(@Param('productId') productId: string, @Body() inventory: Partial<Inventory>,@Res() response) {
    // This REST endpoint for update might need more thought.
    // The gRPC reserve/release are more specific.
    // For now, let's assume it updates non-stock fields or is a full override.
    // The service layer's `_updateInventoryInTransaction` is more for internal use.
    // A dedicated service method for this kind of update might be needed.
    // For now, commenting out the data part as `inventoryService.update` is not directly suitable.
    ResponseUtil.success({
      response,
      message: 'Inventory update request received (implementation pending for general update)',
      // data: await this.inventoryService.someGeneralUpdateMethod(productId, inventory),
      statusCode:HttpStatus.OK
    });
  }

  @Delete(':productId') // Changed param name
  @ApiParam({ name: 'productId', type: String, description: 'Product ID (number)' })
  async deleteInventory(@Param('productId') productId: string,@Res() response): Promise<void> {
    ResponseUtil.success({
      response,
      message: 'Inventory deleted successfully',
      data: await this.inventoryService.delete(productId),
      statusCode:HttpStatus.NO_CONTENT
    });
  }
}