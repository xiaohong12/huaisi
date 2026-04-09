import { request } from "@/utils/request";
import type { ApiResponse } from "@/types/api";

/** 商城列表每页条数（与 Pinia 首屏缓存、后端分页一致） */
export const MALL_PAGE_SIZE = 20;

/**
 * 商城列表单项（与 GET /api/mall/products 的 list 元素一致）。
 */
export interface MallProductListItemDTO {
  id: number;
  title: string;
  price: number;
  soldCount: number;
  /** 可售库存件数（与库字段 stock 一致） */
  stock: number;
  coverUrl: string;
  coverAspect: number;
  /** 是否支持七天无理由退换（由库字段 seven_day_no_reason 映射） */
  sevenDayNoReason?: boolean;
}

/**
 * 商城列表分页载荷。
 */
export interface MallProductListData {
  list: MallProductListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * 商品详情（与 GET /api/mall/products/:id 一致）。
 */
export interface MallProductDetailDTO extends MallProductListItemDTO {
  detailImages: string[];
  description: string;
}

/**
 * 分页拉取商城商品列表，供瀑布流无限滚动加载。
 */
export const getMallProductListApi = (
  page: number,
  pageSize: number = MALL_PAGE_SIZE
): Promise<ApiResponse<MallProductListData>> => {
  const q = `page=${page}&pageSize=${pageSize}`;
  return request<MallProductListData>({ url: `/api/mall/products?${q}` });
};

/**
 * 按 id 获取商品详情，供二级详情页展示。
 */
export const getMallProductDetailApi = (id: number): Promise<ApiResponse<MallProductDetailDTO>> => {
  return request<MallProductDetailDTO>({ url: `/api/mall/products/${id}` });
};

/**
 * 购物车单行（与 GET /api/mall/cart 的 list 元素一致）。
 */
export interface MallCartItemDTO {
  /** 购物车表主键 mall_cart_items.id */
  id: number;
  productId: number;
  title: string;
  price: number;
  quantity: number;
  checked: boolean;
  stock: number;
  coverUrl: string;
  coverAspect: number;
  status: number;
  sevenDayNoReason: boolean;
  subtotal: number;
}

/**
 * 购物车列表载荷。
 */
export interface MallCartListData {
  list: MallCartItemDTO[];
  totalCount: number;
  totalAmount: number;
}

/**
 * 拉取当前登录用户购物车列表，供底部购物车弹层展示。
 */
export const getMallCartApi = (): Promise<ApiResponse<MallCartListData>> => {
  return request<MallCartListData>({ url: "/api/mall/cart" });
};

/**
 * 加入购物车：同一商品重复加入时后端会累加数量。
 */
export const addMallCartApi = (
  productId: number,
  quantity: number = 1
): Promise<ApiResponse<{ id: number; userId: number; productId: number; quantity: number }>> => {
  return request({
    url: "/api/mall/cart/add",
    method: "POST",
    data: { productId, quantity },
  });
};

/**
 * 修改购物车项：可更新数量、勾选状态，或两者同时更新。
 */
export const updateMallCartItemApi = (
  cartId: number,
  data: { quantity?: number; checked?: boolean }
): Promise<ApiResponse<{ id: number; quantity: number; checked: boolean }>> => {
  return request({
    url: `/api/mall/cart/${cartId}`,
    method: "PUT",
    data,
  });
};

/**
 * 仅修改购物车项数量（对 updateMallCartItemApi 的便捷封装）。
 */
export const updateMallCartQuantityApi = (
  cartId: number,
  quantity: number
): Promise<ApiResponse<{ id: number; quantity: number; checked: boolean }>> => {
  return updateMallCartItemApi(cartId, { quantity });
};

/**
 * 全选或取消全选当前用户购物车，用于底部「全选」与合计联动。
 */
export const selectAllMallCartApi = (
  checked: boolean
): Promise<ApiResponse<{ checked: boolean }>> => {
  return request({
    url: "/api/mall/cart/select-all",
    method: "PUT",
    data: { checked },
  });
};

/**
 * 删除购物车中一条记录。
 */
export const deleteMallCartItemApi = (cartId: number): Promise<ApiResponse<{ id: number }>> => {
  return request({
    url: `/api/mall/cart/${cartId}`,
    method: "DELETE",
  });
};

/**
 * 清空当前用户购物车。
 */
export const clearMallCartApi = (): Promise<ApiResponse<{ deletedCount: number }>> => {
  return request({
    url: "/api/mall/cart",
    method: "DELETE",
  });
};
