// Original file: apps/cart/src/proto/cart.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { CartResponseDto as _cart_CartResponseDto, CartResponseDto__Output as _cart_CartResponseDto__Output } from '../cart/CartResponseDto';
import type { ClearCartByUserIdRequest as _cart_ClearCartByUserIdRequest, ClearCartByUserIdRequest__Output as _cart_ClearCartByUserIdRequest__Output } from '../cart/ClearCartByUserIdRequest';
import type { ClearCartByUserIdResponse as _cart_ClearCartByUserIdResponse, ClearCartByUserIdResponse__Output as _cart_ClearCartByUserIdResponse__Output } from '../cart/ClearCartByUserIdResponse';
import type { GetActiveCartByUserIdRequest as _cart_GetActiveCartByUserIdRequest, GetActiveCartByUserIdRequest__Output as _cart_GetActiveCartByUserIdRequest__Output } from '../cart/GetActiveCartByUserIdRequest';

export interface CartServiceClient extends grpc.Client {
  clearCartByUserId(argument: _cart_ClearCartByUserIdRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_cart_ClearCartByUserIdResponse__Output>): grpc.ClientUnaryCall;
  clearCartByUserId(argument: _cart_ClearCartByUserIdRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_cart_ClearCartByUserIdResponse__Output>): grpc.ClientUnaryCall;
  clearCartByUserId(argument: _cart_ClearCartByUserIdRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_cart_ClearCartByUserIdResponse__Output>): grpc.ClientUnaryCall;
  clearCartByUserId(argument: _cart_ClearCartByUserIdRequest, callback: grpc.requestCallback<_cart_ClearCartByUserIdResponse__Output>): grpc.ClientUnaryCall;
  
  getActiveCartByUserId(argument: _cart_GetActiveCartByUserIdRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_cart_CartResponseDto__Output>): grpc.ClientUnaryCall;
  getActiveCartByUserId(argument: _cart_GetActiveCartByUserIdRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_cart_CartResponseDto__Output>): grpc.ClientUnaryCall;
  getActiveCartByUserId(argument: _cart_GetActiveCartByUserIdRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_cart_CartResponseDto__Output>): grpc.ClientUnaryCall;
  getActiveCartByUserId(argument: _cart_GetActiveCartByUserIdRequest, callback: grpc.requestCallback<_cart_CartResponseDto__Output>): grpc.ClientUnaryCall;
  
}

export interface CartServiceHandlers extends grpc.UntypedServiceImplementation {
  clearCartByUserId: grpc.handleUnaryCall<_cart_ClearCartByUserIdRequest__Output, _cart_ClearCartByUserIdResponse>;
  
  getActiveCartByUserId: grpc.handleUnaryCall<_cart_GetActiveCartByUserIdRequest__Output, _cart_CartResponseDto>;
  
}

export interface CartServiceDefinition extends grpc.ServiceDefinition {
  clearCartByUserId: MethodDefinition<_cart_ClearCartByUserIdRequest, _cart_ClearCartByUserIdResponse, _cart_ClearCartByUserIdRequest__Output, _cart_ClearCartByUserIdResponse__Output>
  getActiveCartByUserId: MethodDefinition<_cart_GetActiveCartByUserIdRequest, _cart_CartResponseDto, _cart_GetActiveCartByUserIdRequest__Output, _cart_CartResponseDto__Output>
}
