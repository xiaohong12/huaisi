import { useCallback, useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, Trash2, Eye } from 'lucide-react'
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

// 模拟帖子数据类型
interface PostItem {
  id: number
  authorName: string
  excerpt: string
  likes: number
  comments: number
  status: 'normal' | 'hidden'
  createdAt: string
}

function PostStatusBadge({ status }: { status: PostItem['status'] }) {
  if (status === 'normal') {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:border-green-900/50 dark:bg-green-900/30 dark:text-green-400">
        正常
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400">
      已隐藏
    </span>
  )
}

/**
 * 帖子中心：遵循 web-table-standard 规范的表格页面。
 * 当前使用模拟数据，后续对接 /api/admin/posts 接口。
 */
export function ContentOpsPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keywordInput, setKeywordInput] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [list, setList] = useState<PostItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // 模拟加载数据
  const load = useCallback(() => {
    setLoading(true)
    setTimeout(() => {
      const mockData: PostItem[] = Array.from({ length: pageSize }).map((_, i) => {
        const id = 10000 + (page - 1) * pageSize + i
        return {
          id,
          authorName: `作者_${id}`,
          excerpt: `这是一段关于帖子 ${id} 的摘要内容，可能会比较长，用于测试表格的截断显示效果...`,
          likes: Math.floor(Math.random() * 500),
          comments: Math.floor(Math.random() * 100),
          status: Math.random() > 0.8 ? 'hidden' : 'normal',
          createdAt: new Date(Date.now() - Math.random() * 10000000000).toLocaleString('zh-CN'),
        }
      })
      setList(mockData)
      setTotal(342) // 模拟总数
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
          <CardTitle className="text-2xl font-normal">帖子中心</CardTitle>
          <CardDescription className="text-base">
            轮播、版块、帖子、评论与点赞收藏等管理。当前展示模拟数据，后续接入 admin posts 接口。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form
            onSubmit={handleSearch}
            className="mb-6 flex flex-wrap items-center gap-3"
            role="search"
            aria-label="按内容搜索"
          >
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="输入帖子内容关键词搜索..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-8 rounded-md bg-transparent pl-9 pr-4"
                aria-label="帖子搜索"
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
                  <TableHead className="w-16 font-medium text-foreground">ID</TableHead>
                  <TableHead className="w-32 font-medium text-foreground">发布者</TableHead>
                  <TableHead className="font-medium text-foreground">内容摘要</TableHead>
                  <TableHead className="w-20 font-medium text-foreground text-right">点赞</TableHead>
                  <TableHead className="w-20 font-medium text-foreground text-right">评论</TableHead>
                  <TableHead className="w-24 font-medium text-foreground">状态</TableHead>
                  <TableHead className="w-40 font-medium text-foreground">发布时间</TableHead>
                  <TableHead className="w-24 font-medium text-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((post) => (
                    <TableRow key={post.id} className="group transition-colors hover:bg-muted/50">
                      <TableCell className="text-muted-foreground">{post.id}</TableCell>
                      <TableCell className="font-medium text-foreground">{post.authorName}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground" title={post.excerpt}>
                        {post.excerpt}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{post.likes}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{post.comments}</TableCell>
                      <TableCell>
                        <PostStatusBadge status={post.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {post.createdAt}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground hover:text-primary">
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 rounded-md text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
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
