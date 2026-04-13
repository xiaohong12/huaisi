import { useCallback, useEffect, useState } from 'react'
import { Search, User, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AdminUserListItem } from '@/api/adminUsers'
import { fetchAdminUserList } from '@/api/adminUsers'
import { getApiBase } from '@/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import './HomePage.css'

function GenderBadge({ g }: { g: string }) {
  if (g === 'male') {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-400">
        男
      </span>
    )
  }
  if (g === 'female') {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-pink-200 bg-pink-50 px-2 py-0.5 text-xs text-pink-700 dark:border-pink-900/50 dark:bg-pink-900/30 dark:text-pink-400">
        女
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-800/50 dark:bg-gray-800/30 dark:text-gray-400">
      未知
    </span>
  )
}

function AvatarCell({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <User className="size-4 text-muted-foreground" />
      </div>
    )
  }
  const src = url.startsWith('/') ? `${getApiBase()}${url}` : url
  return (
    <img
      src={src}
      alt="avatar"
      className="size-8 shrink-0 rounded-full border border-border object-cover"
      onError={(e) => {
        // Fallback if image fails to load
        e.currentTarget.style.display = 'none'
        e.currentTarget.parentElement?.classList.add('fallback-avatar-shown')
      }}
    />
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

/**
 * 用户中心：分页表格展示 users 表，支持按用户名搜索（shadcn Table / Input / Button）。
 */
export function UsersAdminPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keywordInput, setKeywordInput] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [list, setList] = useState<AdminUserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const json = await fetchAdminUserList({
        page,
        pageSize,
        username: appliedKeyword || undefined,
      })
      if (json.code !== 0 || !json.data) {
        setError(json.message || '加载失败')
        setList([])
        setTotal(0)
        return
      }
      setList(json.data.list)
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

  return (
    <div className="admin-subpage">
      <Card className="bg-white rounded-[15px] border-none shadow-sm">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-2xl font-normal">用户中心</CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form
            onSubmit={handleSearch}
            className="mb-6 flex flex-wrap items-center gap-3"
            role="search"
            aria-label="按用户名搜索"
          >
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="输入用户名关键词搜索..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-8 rounded-md bg-transparent pl-9 pr-4"
                aria-label="用户名搜索"
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
                  <TableHead className="w-16 font-medium text-foreground">ID</TableHead>
                  <TableHead className="font-medium text-foreground">头像</TableHead>
                  <TableHead className="font-medium text-foreground">用户名</TableHead>
                  <TableHead className="font-medium text-foreground">昵称</TableHead>
                  <TableHead className="font-medium text-foreground">手机</TableHead>
                  <TableHead className="font-medium text-foreground">OpenID</TableHead>
                  <TableHead className="font-medium text-foreground">性别</TableHead>
                  <TableHead className="font-medium text-foreground">注册时间</TableHead>
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
                  list.map((u) => (
                    <TableRow key={u.id} className="group transition-colors hover:bg-muted/50">
                      <TableCell className="text-muted-foreground">{u.id}</TableCell>
                      <TableCell>
                        <div className="relative flex items-center">
                          <AvatarCell url={u.avatar} />
                          <div className="fallback-avatar hidden size-8 shrink-0 items-center justify-center rounded-full bg-muted group-[.fallback-avatar-shown]:flex">
                            <User className="size-4 text-muted-foreground" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{u.username}</TableCell>
                      <TableCell>{u.nickname || <span className="text-muted-foreground/50">—</span>}</TableCell>
                      <TableCell>{u.phone || <span className="text-muted-foreground/50">—</span>}</TableCell>
                      <TableCell>
                        {u.openid ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {u.openid}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <GenderBadge g={u.gender} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTime(u.created_at)}
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
