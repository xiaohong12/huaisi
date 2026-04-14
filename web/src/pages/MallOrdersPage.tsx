import { useCallback, useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import type { AdminMallProductDetail, AdminOrderListItem } from '@/api/adminOrders'
import { fetchAdminMallProductDetail, fetchAdminOrderList } from '@/api/adminOrders'
import { ProductPreviewDialog } from '@/components/orders/ProductPreviewDialog'
import { getApiBase } from '@/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import './HomePage.css'

interface OrderItem extends Omit<AdminOrderListItem, 'status'> {
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
}

function OrderStatusBadge({ status }: { status: OrderItem['status'] }) {
  const map: Record<OrderItem['status'], { label: string; className: string }> = {
    pending: {
      label: '待付款',
      className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-900/30 dark:text-orange-400',
    },
    paid: {
      label: '已付款',
      className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-400',
    },
    shipped: {
      label: '已发货',
      className: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/30 dark:text-indigo-400',
    },
    completed: {
      label: '已完成',
      className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/30 dark:text-green-400',
    },
    cancelled: {
      label: '已取消',
      className: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800/50 dark:bg-gray-800/30 dark:text-gray-400',
    },
  }
  const conf = map[status]
  return (
    <span className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs ${conf.className}`}>
      {conf.label}
    </span>
  )
}

/**
 * 订单中心：遵循 web-table-standard 规范的表格页面，展示后台订单列表。
 */
export function MallOrdersPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keywordInput, setKeywordInput] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [list, setList] = useState<OrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewOrder, setPreviewOrder] = useState<OrderItem | null>(null)
  const [previewDetail, setPreviewDetail] = useState<AdminMallProductDetail | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  /**
   * 加载管理后台订单列表：包含商品主图（第一张）和商品名称。
   */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const json = await fetchAdminOrderList({
        page,
        pageSize,
        keyword: appliedKeyword || undefined,
      })

      if (json.code !== 0 || !json.data) {
        setError(json.message || '加载失败')
        setList([])
        setTotal(0)
        return
      }

      setList(
        json.data.list.map((item) => ({
          ...item,
          status: item.status === 'paid' ? 'paid' : 'pending',
        }))
      )
      setTotal(json.data.total)
    } catch {
      setError('网络错误，请检查后端是否启动')
      setList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, appliedKeyword])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedKeyword(keywordInput.trim())
    setPage(1)
  }

  /**
   * 将后端返回的商品主图地址转为浏览器可直接展示的地址。
   */
  const resolveProductCoverSrc = (raw: string): string => {
    if (!raw) return ''
    if (raw.startsWith('data:image')) return raw
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    if (raw.startsWith('/')) return `${getApiBase()}${raw}`
    return `${getApiBase()}/${raw.replace(/^\/+/, '')}`
  }

  /**
   * 统一格式化时间，避免后端返回 ISO 时在表格和弹窗里可读性差。
   */
  const formatTime = (value: string): string => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('zh-CN')
  }

  /**
   * 点击商品名后打开商品详情弹窗，并拉取完整商品信息（含多张详情图）。
   */
  const openProductPreview = useCallback(async (order: OrderItem) => {
    setPreviewOrder(order)
    setPreviewDetail(null)
    setPreviewError(null)

    if (!order.productId) {
      setPreviewError('未获取到商品 ID，无法加载完整详情')
      return
    }

    setPreviewLoading(true)
    try {
      const json = await fetchAdminMallProductDetail(order.productId)
      if (json.code !== 0 || !json.data) {
        setPreviewError(json.message || '商品详情加载失败')
        return
      }
      setPreviewDetail(json.data)
    } catch {
      setPreviewError('网络错误，商品详情加载失败')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  /**
   * 关闭商品详情弹窗并重置局部状态，避免下次打开残留上一次数据。
   */
  const closeProductPreview = useCallback(() => {
    setPreviewOrder(null)
    setPreviewDetail(null)
    setPreviewError(null)
    setPreviewLoading(false)
  }, [])

  return (
    <div className="admin-subpage">
      <Card className="bg-white rounded-[30px] border-none shadow-sm">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-2xl font-normal">订单中心</CardTitle>
          <CardDescription className="text-base">
            商城订单查询、发货与售后处理，列表已支持展示订单首件商品主图和商品名称。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form
            onSubmit={handleSearch}
            className="mb-6 flex flex-wrap items-center gap-3"
            role="search"
            aria-label="按订单号搜索"
          >
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="输入订单号、用户名或商品名搜索..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-8 rounded-md bg-transparent pl-9 pr-4"
                aria-label="订单搜索"
              />
            </div>
            <Button type="submit" className="h-8 rounded-md px-4">
              搜索
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-md px-4"
              onClick={() => {
                setKeywordInput('')
                setAppliedKeyword('')
                setPage(1)
              }}
            >
              重置
            </Button>
          </form>

          {error ? (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-md border border-border bg-transparent">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-medium text-foreground">订单号</TableHead>
                  <TableHead className="font-medium text-foreground">商品信息</TableHead>
                  <TableHead className="font-medium text-foreground">下单用户</TableHead>
                  <TableHead className="font-medium text-foreground">订单金额</TableHead>
                  <TableHead className="font-medium text-foreground">状态</TableHead>
                  <TableHead className="font-medium text-foreground">下单时间</TableHead>
                  <TableHead className="w-24 font-medium text-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((order) => (
                    <TableRow key={order.id} className="group transition-colors hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{order.orderNo}</TableCell>
                      <TableCell>
                        {order.productName ? (
                          <div className="flex items-center gap-2">
                            {order.productCover ? (
                              <img
                                src={resolveProductCoverSrc(order.productCover)}
                                alt={order.productName}
                                className="size-10 shrink-0 rounded-md border border-border object-cover"
                              />
                            ) : (
                              <div className="size-10 shrink-0 rounded-md border border-dashed border-border bg-muted/40" />
                            )}
                            <button
                              type="button"
                              title="点击查看商品信息"
                              className="max-w-[280px] truncate text-left text-sm text-blue-600 underline decoration-dashed underline-offset-4 hover:text-blue-700"
                              onClick={() => void openProductPreview(order)}
                            >
                              {order.productName}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground">{order.username}</span>
                          <span className="text-xs text-muted-foreground">ID: {order.userId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground font-mono">¥{Number(order.totalAmount).toFixed(2)}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTime(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground hover:text-primary">
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 mr-auto">
              <span>共 <strong className="font-medium text-foreground">{total}</strong> 条记录</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-md"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2 font-medium text-foreground">{page}</span>
              <span className="text-muted-foreground">/</span>
              <span className="px-2">{totalPages}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-md"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProductPreviewDialog
        open={Boolean(previewOrder)}
        order={previewOrder}
        detail={previewDetail}
        loading={previewLoading}
        error={previewError}
        onClose={closeProductPreview}
        resolveProductCoverSrc={resolveProductCoverSrc}
        formatTime={formatTime}
      />
    </div>
  )
}
