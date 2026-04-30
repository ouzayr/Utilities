export interface OrderLine {
  productId: number;
  quantity: number;
}
export interface Order {
  id: number;
  reference: string;
  status: string;
  customerId: number;
  lines: OrderLine[];
}
export interface CreateOrderRequest {
  customerId: number;
  lines: OrderLine[];
}
export interface UpdateOrderStatusRequest {
  status: string;
}
