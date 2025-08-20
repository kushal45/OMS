import { Controller, Get, Post, Put, Delete, Body, Param, HttpStatus, Res, NotFoundException } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices'; // Import GrpcMethod
import { ProductService } from './product.service';
import { Product } from './entity/product.entity';
import { ResponseUtil } from '@app/utils/response.util';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Metadata, ServerUnaryCall } from '@grpc/grpc-js'; // For gRPC types if needed

// Define the expected request structure for GetProductById gRPC call
interface GetProductByIdRequest {
  productId: number;
}

// Define the structure for ProductMessage (matches product.proto)
// This can be auto-generated from proto in a more advanced setup
interface ProductMessage {
  id: number;
  name: string;
  description: string;
  sku: string;
  price: number;
  attributes: string;
}

@Controller('products') // Keep HTTP controller for existing REST API
@ApiTags('products')
@ApiSecurity('api-key')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  healthCheck(@Res() response) {
    response.status(HttpStatus.OK).send('OK');
  }

  // gRPC Method Handler
  @GrpcMethod('ProductService', 'GetProductById')
  async getProductByIdGrpc(data: GetProductByIdRequest, metadata?: Metadata, call?: ServerUnaryCall<any, any>): Promise<ProductMessage> {
    const productId = data.productId;
    const productEntity = await this.productService.getProductById(productId); // Assumes this method throws if not found

    if (!productEntity) {
      // This will be converted to a gRPC NOT_FOUND error by NestJS
      throw new NotFoundException(`Product with ID ${productId} not found.`);
    }
    // Map entity to ProductMessage
    return {
      id: productEntity.id,
      name: productEntity.name,
      description: productEntity.description,
      sku: productEntity.sku,
      price: productEntity.price,
      attributes: productEntity.attributes,
    };
  }
  
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

  // HTTP GET /products/:id - This can coexist with the gRPC method
  @Get(':id')
  async getProductByIdHttp(@Param('id') id: number,@Res() response) {
    // Note: productService.getProductById might throw NotFoundException which is fine for HTTP
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