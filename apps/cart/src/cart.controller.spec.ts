import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { AddItemToCartDto, UpdateCartItemDto } from './dto/cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { HttpStatus } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ResponseUtil } from '@app/utils/response.util'; // Assuming this path

// Mock a minimal ModuleRef
const mockModuleRef = {
  get: jest.fn(),
};

describe('CartController', () => {
  let cartController: CartController;
  let cartService: CartService;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(async () => {
    mockRequest = {
      params: {},
      headers: {
        'x-correlation-id': 'test-trace-id',
        'x-user-data': JSON.stringify({ id: 'user-uuid-123' }), // Example user data
      },
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        {
          provide: CartService,
          useValue: {
            getCartByUserId: jest.fn(),
            addItemToCart: jest.fn(),
            updateCartItem: jest.fn(),
            removeItemFromCart: jest.fn(),
            clearCart: jest.fn(),
          },
        },
        {
          provide: ModuleRef,
          useValue: mockModuleRef, // Provide the mock ModuleRef
        },
      ],
    }).compile();

    cartController = module.get<CartController>(CartController);
    cartService = module.get<CartService>(CartService);
  });

  it('should be defined', () => {
    expect(cartController).toBeDefined();
  });

  describe('health', () => {
    it('should return OK', async () => {
      await cartController.health(mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.send).toHaveBeenCalledWith('OK');
    });
  });

  describe('getCartByUserId', () => {
    it('should return a cart for a user', async () => {
      const userId = 'user-uuid-123';
      const traceId = 'test-trace-id';
      const expectedCart: CartResponseDto = {
        id: 'cart-uuid-1',
        userId,
        items: [],
        subTotal: 0,
        totalItems: 0,
        grandTotal: 0,
      };
      jest.spyOn(cartService, 'getCartByUserId').mockResolvedValue(expectedCart);

      await cartController.getCartByUserId(userId, mockResponse, mockRequest);

      expect(cartService.getCartByUserId).toHaveBeenCalledWith(userId, traceId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cart fetched successfully.',
          data: expectedCart,
        }),
      );
    });
  });

  describe('addItemToCart', () => {
    it('should add an item to the cart and return the updated cart', async () => {
      const userId = 'user-uuid-123';
      const traceId = 'test-trace-id';
      const addItemDto: AddItemToCartDto = { productId: 'prod-abc', quantity: 1 };
      const expectedCart: CartResponseDto = {
        id: 'cart-uuid-1',
        userId,
        items: [{ productId: 'prod-abc', quantity: 1, price: 10 }],
        subTotal: 10,
        totalItems: 1,
        grandTotal: 10,
      };
      jest.spyOn(cartService, 'addItemToCart').mockResolvedValue(expectedCart);

      await cartController.addItemToCart(userId, addItemDto, mockResponse, mockRequest);

      expect(cartService.addItemToCart).toHaveBeenCalledWith(userId, addItemDto, traceId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Item added to cart successfully.',
          data: expectedCart,
        }),
      );
    });
  });

  describe('updateCartItem', () => {
    it('should update an item in the cart and return the updated cart', async () => {
      const userId = 'user-uuid-123';
      const itemId = 'item-uuid-xyz'; // This should be cartItem ID
      const traceId = 'test-trace-id';
      const updateDto: UpdateCartItemDto = { quantity: 3 };
      const expectedCart: CartResponseDto = {
        id: 'cart-uuid-1',
        userId,
        items: [{ productId: 'prod-abc', quantity: 3, price: 10 }],
        subTotal: 30,
        totalItems: 3,
        grandTotal: 30,
      };
      jest.spyOn(cartService, 'updateCartItem').mockResolvedValue(expectedCart);

      await cartController.updateCartItem(userId, itemId, updateDto, mockResponse, mockRequest);

      expect(cartService.updateCartItem).toHaveBeenCalledWith(userId, itemId, updateDto, traceId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cart item updated successfully.',
          data: expectedCart,
        }),
      );
    });
  });

  describe('removeItemFromCart', () => {
    it('should remove an item from the cart and return the updated cart', async () => {
      const userId = 'user-uuid-123';
      const itemId = 'item-uuid-xyz';
      const traceId = 'test-trace-id';
      const expectedCart: CartResponseDto = {
        id: 'cart-uuid-1',
        userId,
        items: [],
        subTotal: 0,
        totalItems: 0,
        grandTotal: 0,
      };
      jest.spyOn(cartService, 'removeItemFromCart').mockResolvedValue(expectedCart);

      await cartController.removeItemFromCart(userId, itemId, mockResponse, mockRequest);

      expect(cartService.removeItemFromCart).toHaveBeenCalledWith(userId, itemId, traceId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Item removed from cart successfully.',
          data: expectedCart,
        }),
      );
    });
  });

  describe('clearCart', () => {
    it('should clear the cart for a user', async () => {
      const userId = 'user-uuid-123';
      const traceId = 'test-trace-id';
      jest.spyOn(cartService, 'clearCart').mockResolvedValue(undefined); // clearCart returns void

      await cartController.clearCart(userId, mockResponse, mockRequest);

      expect(cartService.clearCart).toHaveBeenCalledWith(userId, traceId);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cart cleared successfully.',
        }),
      );
    });
  });

  // Test for onModuleInit if it has any logic other than schema registration
  // For now, assuming registerSchema is the main part.
  // If registerSchema is called, you might want to spy on it.
  // For this example, if onModuleInit only calls registerSchema,
  // and registerSchema itself is a utility that doesn't need to be unit tested here,
  // then testing onModuleInit might not be critical unless it has other side effects.
});