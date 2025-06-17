// Original file: apps/cart/src/proto/cart.proto

import type { CartItemDto as _cart_CartItemDto, CartItemDto__Output as _cart_CartItemDto__Output } from '../cart/CartItemDto';

export interface CartResponseDto {
  'id'?: (string);
  'userId'?: (string);
  'items'?: (_cart_CartItemDto)[];
  'subTotal'?: (number | string);
  'totalItems'?: (number);
  'discount'?: (number | string);
  'tax'?: (number | string);
  'grandTotal'?: (number | string);
  'updatedAt'?: (string);
}

export interface CartResponseDto__Output {
  'id'?: (string);
  'userId'?: (string);
  'items'?: (_cart_CartItemDto__Output)[];
  'subTotal'?: (number);
  'totalItems'?: (number);
  'discount'?: (number);
  'tax'?: (number);
  'grandTotal'?: (number);
  'updatedAt'?: (string);
}
