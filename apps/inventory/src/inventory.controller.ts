import { Controller, Get, Post, Put, Delete, Body, Param, Res, HttpStatus } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Inventory } from './entity/inventory.entity';
import { ResponseUtil } from '@app/utils/response.util';
import { response } from 'express';


@Controller('inventories')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  async createInventory(@Body() inventory: Partial<Inventory>, @Res() response) {
    ResponseUtil.success({
      response,
      message: 'Inventory created successfully',
      data: await this.inventoryService.createInventory(inventory),
      statusCode:HttpStatus.CREATED
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

  @Get(':id')
  async getInventoryById(@Param('id') id: number, @Res() response) {
    ResponseUtil.success({
      response,
      message: 'Successfully fetched inventory',
      data: await this.inventoryService.getInventoryById(id),
      statusCode:HttpStatus.OK
    })
  }

  @Put(':id')
  async updateInventory(@Param('id') id: number, @Body() inventory: Partial<Inventory>,@Res() response) {
    ResponseUtil.success({
      response,
      message: 'Inventory updated successfully',
      data: await this.inventoryService.updateInventory(id, inventory),
      statusCode:HttpStatus.OK
    });
  }

  @Delete(':id')
  async deleteInventory(@Param('id') id: number,@Res() response): Promise<void> {
    ResponseUtil.success({
      response,
      message: 'Inventory deleted successfully',
      data: await this.inventoryService.deleteInventory(id),
      statusCode:HttpStatus.NO_CONTENT
    });
  }
}