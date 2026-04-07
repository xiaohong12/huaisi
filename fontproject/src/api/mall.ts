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
