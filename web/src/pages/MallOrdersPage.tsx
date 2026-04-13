import { useCallback, useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
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

// 模拟订单数据类型
interface OrderItem {
  id: string
  userId: number
  username: string
  totalAmount: string
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
  createdAt: string
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
 * 订单中心：遵循 web-table-standard 规范的表格页面。
 * 当前使用模拟数据，后续对接 /api/admin/orders 接口。
 */
export function MallOrdersPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keywordInput, setKeywordInput] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [list, setList] = useState<OrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // 模拟加载数据
  const load = useCallback(() => {
    setLoading(true)
    setTimeout(() => {
      const mockData: OrderItem[] = Array.from({ length: pageSize }).map((_, i) => {
        const id = `ORD${Date.now()}${i}`
        const statuses: OrderItem['status'][] = ['pending', 'paid', 'shipped', 'completed', 'cancelled']
        return {
          id,
          userId: 1000 + i,
          username: `user_${1000 + i}`,
          totalAmount: (Math.random() * 1000).toFixed(2),
          status: statuses[i % statuses.length],
          createdAt: new Date(Date.now() - Math.random() * 10000000000).toLocaleString('zh-CN'),
        }
      })
      setList(mockData)
      setTotal(156) // 模拟总数
      setLoading(false)
    }, 500)
  }, [page, pageSize, appliedKeyword])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedKeyword(keywordInput.trim())
    setPage(1)
  }

  return (
    <div className="admin-subpage">
      <Card className="bg-white rounded-[30px] border-none shadow-sm">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-2xl font-normal">订单中心</CardTitle>
          <CardDescription className="text-base">
            商城订单查询、发货与售后处理。当前展示模拟数据，后续接入 admin orders 接口。
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
                placeholder="输入订单号或用户名搜索..."
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

          <div className="overflow-hidden rounded-md border border-border bg-transparent">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-medium text-foreground">订单号</TableHead>
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
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((order) => (
                    <TableRow key={order.id} className="group transition-colors hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{order.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground">{order.username}</span>
                          <span className="text-xs text-muted-foreground">ID: {order.userId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground font-mono">¥{order.totalAmount}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {order.createdAt}
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
    </div>
  )
}
