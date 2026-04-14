import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { AdminMallProductDetail, AdminOrderProductSnapshot } from '@/api/adminOrders'
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
  /** 当前商城商品详情（与 snapshot 二选一或均无，加载中时均为 null） */
  detail: AdminMallProductDetail | null
  /** 下单时固化的商品快照（优先于 detail 展示） */
  snapshot?: AdminOrderProductSnapshot | null
  /** 为 true 且正在加载、尚无 snapshot 时，不套用实时商品布局，避免误展示订单总金额等字段 */
  expectsSnapshot?: boolean
  loading: boolean
  error: string | null
  onClose: () => void
  resolveProductCoverSrc: (raw: string) => string
  formatTime: (value: string) => string
}

/**
 * 商品预览弹窗：展示轮播图与商品核心信息；若传入 snapshot 则展示下单快照而非实时商品库数据。
 */
export function ProductPreviewDialog({
  open,
  order,
  detail,
  snapshot = null,
  expectsSnapshot = false,
  loading,
  error,
  onClose,
  resolveProductCoverSrc,
  formatTime,
}: ProductPreviewDialogProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const useSnapshot = Boolean(snapshot)

  /**
   * 弹窗轮播图列表：快照模式用快照详情图；否则优先商品详情图，缺省时回退订单首图。
   */
  const previewImages = useMemo(() => {
    if (snapshot?.detailImages?.length) return snapshot.detailImages
    if (snapshot?.coverUrl) return [snapshot.coverUrl]
    if (detail?.detailImages?.length) return detail.detailImages
    if (order?.productCover) return [order.productCover]
    return []
  }, [snapshot, detail, order])

  useEffect(() => {
    if (!open) return
    setActiveImageIndex(0)
  }, [open, order?.orderNo, detail?.id, snapshot?.productId])

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
          <h3 className="text-lg font-medium text-foreground">
            {useSnapshot || (expectsSnapshot && loading) ? '商品信息（下单快照）' : '商品信息'}
          </h3>
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
                  alt={snapshot?.title || detail?.title || order.productName || '商品图'}
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
            {snapshot?.title || detail?.title || order.productName || '—'}
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            {useSnapshot && snapshot ? (
              <>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">下单单价</p>
                  <p className="font-mono text-[#ff4400]">¥{Number(snapshot.unitPrice).toFixed(2)}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">购买数量</p>
                  <p className="text-foreground">{Number(snapshot.purchaseQuantity)}</p>
                </div>
                <div className="col-span-2 rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">该商品行小计（快照）</p>
                  <p className="font-mono text-foreground">¥{Number(snapshot.lineSubtotal).toFixed(2)}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">下单用户</p>
                  <p className="truncate text-foreground">{order.username}（ID: {order.userId}）</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">下单时间</p>
                  <p className="truncate text-foreground">{formatTime(order.createdAt)}</p>
                </div>
              </>
            ) : expectsSnapshot && loading ? (
              <div className="col-span-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                正在读取下单快照…
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
          <div className="space-y-2 border-t border-border pt-3 text-sm">
            {useSnapshot || expectsSnapshot ? (
              <p>
                <span className="text-muted-foreground">说明：</span>
                <span className="text-foreground">以下为下单时固化信息，可能与当前商品页不一致。</span>
              </p>
            ) : (
              <p>
                <span className="text-muted-foreground">服务：</span>
                <span className="text-foreground">{detail?.sevenDayNoReason ? '七天无理由 · 极速发货' : '极速发货'}</span>
              </p>
            )}
            <p>
              <span className="text-muted-foreground">订单号：</span>
              <span className="font-mono text-foreground">{order.orderNo}</span>
            </p>
            <p className="leading-6">
              <span className="text-muted-foreground">详情文案：</span>
              <span className="text-foreground">
                {snapshot?.description || detail?.description || '暂无详细描述'}
              </span>
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {expectsSnapshot ? '商品快照加载中…' : '商品详情加载中…'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
