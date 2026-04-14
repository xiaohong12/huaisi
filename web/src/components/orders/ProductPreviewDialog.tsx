import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { AdminMallProductDetail } from '@/api/adminOrders'
import { Button } from '@/components/ui/button'

export interface ProductPreviewOrder {
  orderNo: string
  userId: number
  username: string
  totalAmount: number
  createdAt: string
  productName: string
  productCover: string
}

interface ProductPreviewDialogProps {
  open: boolean
  order: ProductPreviewOrder | null
  detail: AdminMallProductDetail | null
  loading: boolean
  error: string | null
  onClose: () => void
  resolveProductCoverSrc: (raw: string) => string
  formatTime: (value: string) => string
}

/**
 * 商品预览弹窗：展示轮播图与商品核心信息。
 */
export function ProductPreviewDialog({
  open,
  order,
  detail,
  loading,
  error,
  onClose,
  resolveProductCoverSrc,
  formatTime,
}: ProductPreviewDialogProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  /**
   * 弹窗轮播图列表：优先详情图，缺省时回退订单首图。
   */
  const previewImages = useMemo(() => {
    if (detail?.detailImages?.length) return detail.detailImages
    if (order?.productCover) return [order.productCover]
    return []
  }, [detail, order])

  useEffect(() => {
    if (!open) return
    setActiveImageIndex(0)
  }, [open, order?.orderNo, detail?.id])

  useEffect(() => {
    if (!open || previewImages.length <= 1) return
    const timer = window.setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % previewImages.length)
    }, 2600)
    return () => {
      window.clearInterval(timer)
    }
  }, [open, previewImages.length])

  useEffect(() => {
    if (activeImageIndex <= previewImages.length - 1) return
    setActiveImageIndex(0)
  }, [activeImageIndex, previewImages.length])

  if (!open || !order) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="商品信息弹窗"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-medium text-foreground">商品信息</h3>
          <Button type="button" variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="关闭弹窗">
            <X className="size-4" />
          </Button>
        </div>

        {error ? (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mb-4">
          <div className="mx-auto flex w-full max-w-[360px] items-center justify-center gap-2">
            {previewImages.length > 1 ? (
              <button
                type="button"
                className="shrink-0 rounded-full border border-border bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                onClick={() =>
                  setActiveImageIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length)
                }
                aria-label="上一张"
              >
                <ChevronLeft className="size-4" />
              </button>
            ) : null}
            <div className="relative aspect-16/10 w-full max-w-[300px] overflow-hidden rounded-lg">
              {previewImages.length > 0 ? (
                <img
                  src={resolveProductCoverSrc(previewImages[activeImageIndex] || previewImages[0])}
                  alt={detail?.title || order.productName || '商品图'}
                  className="size-full object-cover transition-all duration-500"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">暂无图片</div>
              )}
            </div>
            {previewImages.length > 1 ? (
              <button
                type="button"
                className="shrink-0 rounded-full border border-border bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                onClick={() => setActiveImageIndex((prev) => (prev + 1) % previewImages.length)}
                aria-label="下一张"
              >
                <ChevronRight className="size-4" />
              </button>
            ) : null}
          </div>

          {previewImages.length > 1 ? (
            <div className="flex items-center justify-center gap-1.5 py-2">
              {previewImages.map((_, idx) => (
                <button
                  key={`dot-${idx}`}
                  type="button"
                  className={`h-1.5 rounded-full transition-all ${idx === activeImageIndex ? 'w-5 bg-orange-500' : 'w-1.5 bg-slate-300'}`}
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`切换到第 ${idx + 1} 张图`}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <p className="mb-3 line-clamp-2 text-[15px] font-medium text-foreground">
            {detail?.title || order.productName || '—'}
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs text-muted-foreground">价格</p>
              <p className="font-mono text-[#ff4400]">¥{Number(detail?.price ?? order.totalAmount).toFixed(2)}</p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs text-muted-foreground">库存 / 销量</p>
              <p className="text-foreground">{Number(detail?.stock ?? 0)} / {Number(detail?.soldCount ?? 0)}</p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs text-muted-foreground">下单用户</p>
              <p className="truncate text-foreground">{order.username}（ID: {order.userId}）</p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs text-muted-foreground">下单时间</p>
              <p className="truncate text-foreground">{formatTime(order.createdAt)}</p>
            </div>
          </div>
          <div className="space-y-2 border-t border-border pt-3 text-sm">
            <p>
              <span className="text-muted-foreground">服务：</span>
              <span className="text-foreground">{detail?.sevenDayNoReason ? '七天无理由 · 极速发货' : '极速发货'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">订单号：</span>
              <span className="font-mono text-foreground">{order.orderNo}</span>
            </p>
            <p className="leading-6">
              <span className="text-muted-foreground">详情文案：</span>
              <span className="text-foreground">{detail?.description || '暂无详细描述'}</span>
            </p>
          </div>
        </div>

        {loading ? <p className="mt-3 text-sm text-muted-foreground">商品详情加载中...</p> : null}
      </div>
    </div>
  )
}
