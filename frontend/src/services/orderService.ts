import axios from "axios";

const API_URL = "http://localhost:5000/api/orders";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
};

export type OrderStatus =
  | "pending"
  | "processing"
  | "handover_to_carrier"
  | "shipping"
  | "delivered"
  | "received"
  | "cancelled";

export interface ShippingInfo {
  fullName: string;
  phone: string;
  email?: string;
  address: string;
  city?: string;
  district?: string;
  ward?: string;
  note?: string;
}

export interface OrderItemPayload {
  productId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  userId?: string;
  shippingInfo: ShippingInfo;
  paymentMethod: string;
  shippingFee?: number;
  discount?: number;
  couponCode?: string;
}

export interface OrderTotals {
  subTotal: number;
  total?: number;
  savings?: number;
  shippingFee: number;
  discount: number;
  grandTotal: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  oldPrice?: number;
  quantity: number;
  selectedColor?: string;
}

export interface Order {
  _id: string;
  code: string;
  userId: string;
  items: OrderItem[];
  shippingInfo: ShippingInfo;
  paymentMethod: string;
  paymentStatus: string;
  status: OrderStatus;
  totals: OrderTotals;
  statusHistory: Array<{
    status: OrderStatus;
    note?: string;
    updatedBy?: string;
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderResponse {
  success: boolean;
  message?: string;
  data: Order;
}

export interface OrderListResponse {
  success: boolean;
  data: Order[];
}

export const createOrder = async (
  payload: CreateOrderPayload
): Promise<OrderResponse> => {
  const response = await axios.post<OrderResponse>(API_URL, payload, {
    headers: authHeaders(),
  });
  return response.data;
};

export const getOrdersByUser = async (
  userId: string
): Promise<OrderListResponse> => {
  const response = await axios.get<OrderListResponse>(
    `${API_URL}/user/${userId}`,
    { headers: authHeaders() }
  );
  return response.data;
};

export const getOrderDetail = async (
  orderId: string
): Promise<OrderResponse> => {
  const response = await axios.get<OrderResponse>(`${API_URL}/${orderId}`, {
    headers: authHeaders(),
  });
  return response.data;
};

export const getAllOrders = async (
  status?: OrderStatus
): Promise<OrderListResponse> => {
  const response = await axios.get<OrderListResponse>(API_URL, {
    headers: authHeaders(),
    params: status ? { status } : undefined,
  });
  return response.data;
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  note?: string
): Promise<OrderResponse> => {
  const response = await axios.patch<OrderResponse>(
    `${API_URL}/${orderId}/status`,
    { status, note },
    { headers: authHeaders() }
  );
  return response.data;
};

export const deleteOrder = async (orderId: string): Promise<{ success: boolean; message?: string }> => {
  const response = await axios.delete<{ success: boolean; message?: string }>(
    `${API_URL}/${orderId}`,
    { headers: authHeaders() }
  );
  return response.data;
};

export const confirmOrderReceived = async (
  orderId: string
): Promise<OrderResponse> => {
  const response = await axios.post<OrderResponse>(
    `${API_URL}/${orderId}/confirm`,
    {},
    { headers: authHeaders() }
  );
  return response.data;
};

export const cancelOrder = async (
  orderId: string
): Promise<OrderResponse> => {
  const response = await axios.post<OrderResponse>(
    `${API_URL}/${orderId}/cancel`,
    {},
    { headers: authHeaders() }
  );
  return response.data;
};

// MOMO Payment
export interface MomoPaymentResponse {
  success: boolean;
  payUrl?: string;
  message?: string;
}

export interface ZaloPaymentResponse {
  success: boolean;
  payUrl?: string;
  appTransId?: string;
  message?: string;
}

export const createZaloPayPayment = async (
  total_zalopay: number,
  orderData: any
): Promise<ZaloPaymentResponse> => {
  const response = await axios.post<ZaloPaymentResponse>(
    "http://localhost:5000/api/zalopay/create",
    { total_zalopay, orderData }
  );
  return response.data;
};

export const createMomoPayment = async (
  total_momo: number,
  orderData: any
): Promise<MomoPaymentResponse> => {
  const response = await axios.post<MomoPaymentResponse>(
    `${API_URL}/momo/create`,
    { total_momo, orderData }
  );
  return response.data;
};