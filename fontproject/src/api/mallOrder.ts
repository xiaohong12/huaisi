import { request } from "@/utils/request";
import type { ApiResponse } from "@/types/api";

/**
 * 创建订单时可选的支付方式（与后端 mall_orders.payment_method 一致）。
 */
export type MallPaymentMethod = "alipay" | "huabei" | "friend_pay" | "wechat" | "qrcode";

/**
 * 创建商城订单请求体（确认下单页提交）。
 */
export interface CreateMallOrderPayload {
  addressId: number;
  productId: number;
  quantity: number;
  paymentMethod: MallPaymentMethod;
  remark?: string;
}

/**
 * 创建订单成功后的载荷：二维码支付时带 qrCodeDataUrl，可直接作为 <image> 的 src。
 */
export interface CreateMallOrderData {
  id: number;
  orderNo: string;
  storeName: string;
  goodsAmount: number;
  freightFee: number;
  totalAmount: number;
  paymentMethod: MallPaymentMethod;
  paymentStatus: number;
  qrCodeDataUrl?: string;
}

/**
 * 订单明细行（与 GET /api/mall/orders/:id 的 items 元素一致）。
 */
export interface MallOrderItemDTO {
  id: number;
  productId: number;
  title: string;
  coverUrl: string;
  price: number;
  quantity: number;
  subtotal: number;
}

/**
 * 订单详情载荷。
 */
export interface MallOrderDetailData {
  id: number;
  orderNo: string;
  storeName: string;
  consignee: string;
  phone: string;
  region: string;
  detail: string;
  freightFee: number;
  goodsAmount: number;
  totalAmount: number;
  paymentMethod: MallPaymentMethod;
  paymentStatus: number;
  remark: string;
  createdAt: string;
  items: MallOrderItemDTO[];
}

/**
 * 提交订单：写入 mall_orders / mall_order_items；二维码支付时返回收款码图片 data URL。
 */
export const createMallOrderApi = (
  payload: CreateMallOrderPayload
): Promise<ApiResponse<CreateMallOrderData>> => {
  return request<CreateMallOrderData>({
    url: "/api/mall/orders",
    method: "POST",
    data: payload as unknown as Record<string, unknown>,
  });
};

/**
 * 查询订单详情（仅本人）。
 */
export const getMallOrderDetailApi = (id: number): Promise<ApiResponse<MallOrderDetailData>> => {
  return request<MallOrderDetailData>({ url: `/api/mall/orders/${id}` });
};

/**
 * 用户点击「已经支付」后调用：将订单标为已支付并扣减库存（线下扫码回款演示流）。
 */
export const confirmMallOrderPaymentApi = (id: number): Promise<ApiResponse<{ id: number; paymentStatus: number }>> => {
  return request<{ id: number; paymentStatus: number }>({
    url: `/api/mall/orders/${id}/confirm-payment`,
    method: "PUT",
  });
};
