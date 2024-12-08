import { Controller, Get, Post, Put, Delete, Body, Param, Res, HttpStatus, Inject } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Inventory } from './entity/inventory.entity';
import { ResponseUtil } from '@app/utils/response.util';
import { ConfigService } from '@nestjs/config';
import { KafkaAdminClient } from '@lib/kafka/KafKaAdminClient';
import { KafkaConsumer } from '@lib/kafka/KafkaConsumer';
import { GrpcMethod } from '@nestjs/microservices';
import { CustomLoggerService } from '@lib/logger/src';
import { registerSchema } from '@app/utils/SchemaRegistry';
import { ModuleRef } from '@nestjs/core';


@Controller('inventories')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(KafkaAdminClient) private readonly kafkaAdminClient: KafkaAdminClient,
    @Inject("KafkaConsumerInstance") private readonly kafkaConsumer: KafkaConsumer,
    private readonly logger: CustomLoggerService,
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
    //await registerSchema(this.moduleRef);
    await this.kafkaAdminClient.createTopic(this.configService.get<string>('INVENTORY_UPDATE_TOPIC'));
    await this.kafkaConsumer.subscribe(this.configService.get<string>('INVENTORY_UPDATE_TOPIC'));
    await this.kafkaConsumer.postSubscribeCallback(async (topic, partition, message) => {
      console.log(`Received message from topic ${topic} partition ${partition} message ${message}`);
    });
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
  async validate(validateOrderItems) {
    try {
      //console.log("validateOrderItems fetched :::",validateOrderItems);
      const validationResponse= await this.inventoryService.validate(validateOrderItems);
      this.logger.info(`InventoryService.validate::: ${JSON.stringify(validationResponse)}`, 'InventoryService.validate');
      return validationResponse;
    } catch (error) {
        console.log(error);
        throw error;
    }
     
  }

  @Get(':id')
  async getInventoryById(@Param('id') id: number, @Res() response) {
    ResponseUtil.success({
      response,
      message: 'Successfully fetched inventory',
      data: await this.inventoryService.fetch(id),
      statusCode:HttpStatus.OK
    })
  }

  @Put(':id')
  async updateInventory(@Param('id') id: number, @Body() inventory: Partial<Inventory>,@Res() response) {
    ResponseUtil.success({
      response,
      message: 'Inventory updated successfully',
      data: await this.inventoryService.update(id, inventory),
      statusCode:HttpStatus.OK
    });
  }

  @Delete(':id')
  async deleteInventory(@Param('id') id: number,@Res() response): Promise<void> {
    ResponseUtil.success({
      response,
      message: 'Inventory deleted successfully',
      data: await this.inventoryService.delete(id),
      statusCode:HttpStatus.NO_CONTENT
    });
  }
}