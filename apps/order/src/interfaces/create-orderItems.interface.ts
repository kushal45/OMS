export interface OrderItemObj {
    productId: number;
    quantity: number;
    price: number;
}

export interface OrderItemsInput {
    orderId: number;
    orderItems: OrderItemObj[];
}