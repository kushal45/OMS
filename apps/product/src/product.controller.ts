import { Controller, Get, Post, Put, Delete, Body, Param, HttpStatus, Res } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from './entity/product.entity';
import { ResponseUtil } from '@app/utils/response.util';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

@Controller('products')
@ApiTags('products')
@ApiSecurity('api-key')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  
  @Post()
  async createProduct(@Body() product: Partial<Product>,@Res() response) {
    ResponseUtil.success({
      response,
      message: 'Product created successfully',
      data: await this.productService.createProduct(product),
      statusCode:HttpStatus.CREATED
    });
  }

  @Get()
  @ApiOperation({ summary: 'Fetch Products' })
  async getProducts(@Res() response) {
    ResponseUtil.success({
      response,
      message: 'Successfully fetched products',
      data: await this.productService.getProducts(),
      statusCode:HttpStatus.OK
    })
  }

  @Get(':id')
  async getProductById(@Param('id') id: number,@Res() response) {
    ResponseUtil.success({
      response,
      message: 'Successfully fetched product',
      data: await this.productService.getProductById(id),
      statusCode:HttpStatus.OK
    })
  }

  @Put(':id')
  async updateProduct(@Param('id') id: number, @Body() product: Partial<Product>,@Res() response) {
    ResponseUtil.success({
      response,
      message: 'Product updated successfully',
      data: await this.productService.updateProduct(id, product),
      statusCode:HttpStatus.OK
    });
  }

  @Delete(':id')
  async deleteProduct(@Param('id') id: number,@Res() response) {
    ResponseUtil.success({
      response,
      message: 'Product deleted successfully',
      data: await this.productService.deleteProduct(id),
      statusCode:HttpStatus.NO_CONTENT
    });
  }
}