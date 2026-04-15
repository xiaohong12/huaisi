import { useCallback, useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, Trash2, Eye, RotateCcw } from 'lucide-react'
import type { AdminPostListItem } from '@/api/adminPosts'
import { deleteAdminPost, fetchAdminPostList, restoreAdminPost } from '@/api/adminPosts'
import { AdminPostPreviewDialog } from '@/components/content/AdminPostPreviewDialog'
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

/** 帖子状态筛选项：空字符串表示不按状态过滤 */
type PostStatusFilterValue = '' | '0' | '1' | '2' | '3'

const POST_STATUS_FILTER_OPTIONS: { value: PostStatusFilterValue; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: '1', label: '正常（已发布）' },
  { value: '2', label: '已隐藏' },
  { value: '0', label: '草稿' },
  { value: '3', label: '已删除' },
]

/**
 * 帖子上下架状态徽标（与 posts.status 数值一致）。
 */
function PostStatusBadge({ status }: { status: number }) {
  if (status === 1) {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:border-green-900/50 dark:bg-green-900/30 dark:text-green-400">
        正常
      </span>
    )
  }
  if (status === 2) {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400">
        已隐藏
      </span>
    )
  }
  if (status === 0) {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-300">
        草稿
      </span>
    )
  }
  if (status === 3) {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400">
        已删除
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      未知({status})
    </span>
  )
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

/**
 * 帖子中心：遵循 web-table-standard 规范的表格页面；数据来自 GET /api/admin/posts。
 */
export function ContentOpsPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keywordInput, setKeywordInput] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [statusFilterInput, setStatusFilterInput] = useState<PostStatusFilterValue>('')
  const [appliedStatus, setAppliedStatus] = useState<PostStatusFilterValue>('')
  const [list, setList] = useState<AdminPostListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewPostId, setPreviewPostId] = useState<number | null>(null)
  const [postPendingDelete, setPostPendingDelete] = useState<AdminPostListItem | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [postPendingRestore, setPostPendingRestore] = useState<AdminPostListItem | null>(null)
  const [restoreSubmitting, setRestoreSubmitting] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const json = await fetchAdminPostList({
        page,
        pageSize,
        keyword: appliedKeyword || undefined,
        status: appliedStatus || undefined,
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
  }, [page, pageSize, appliedKeyword, appliedStatus])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedKeyword(keywordInput.trim())
    setAppliedStatus(statusFilterInput)
    setPage(1)
  }

  const cancelDelete = useCallback(() => {
    if (deleteSubmitting) return
    setPostPendingDelete(null)
    setDeleteError(null)
  }, [deleteSubmitting])

  /** 确认软删除帖子（后端 status=3），成功后刷新列表并关闭同帖预览。 */
  const confirmDelete = useCallback(async () => {
    if (!postPendingDelete) return
    const targetId = postPendingDelete.id
    setDeleteSubmitting(true)
    setDeleteError(null)
    try {
      const json = await deleteAdminPost(targetId)
      if (json.code !== 0) {
        setDeleteError(json.message || '删除失败')
        return
      }
      setPostPendingDelete(null)
      setPreviewPostId((prev) => (prev === targetId ? null : prev))
      await load()
    } catch {
      setDeleteError('网络错误，请稍后重试')
    } finally {
      setDeleteSubmitting(false)
    }
  }, [postPendingDelete, load])

  const cancelRestore = useCallback(() => {
    if (restoreSubmitting) return
    setPostPendingRestore(null)
    setRestoreError(null)
  }, [restoreSubmitting])

  /** 确认恢复帖子（后端 status=1），成功后刷新列表。 */
  const confirmRestore = useCallback(async () => {
    if (!postPendingRestore) return
    const targetId = postPendingRestore.id
    setRestoreSubmitting(true)
    setRestoreError(null)
    try {
      const json = await restoreAdminPost(targetId)
      if (json.code !== 0) {
        setRestoreError(json.message || '恢复失败')
        return
      }
      setPostPendingRestore(null)
      await load()
    } catch {
      setRestoreError('网络错误，请稍后重试')
    } finally {
      setRestoreSubmitting(false)
    }
  }, [postPendingRestore, load])

  return (
    <div className="admin-subpage">
      <Card className="bg-white rounded-[30px] border-none shadow-sm">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-2xl font-normal">帖子中心</CardTitle>
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
                placeholder="输入标题、正文、摘要或发布者关键词搜索..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-8 rounded-md bg-transparent pl-9 pr-4"
                aria-label="帖子搜索"
              />
            </div>
            <div className="flex min-w-[140px] flex-col gap-1 sm:max-w-[180px]">
              <label htmlFor="post-status-filter" className="sr-only">
                帖子状态
              </label>
              <select
                id="post-status-filter"
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={statusFilterInput}
                onChange={(e) => setStatusFilterInput((e.target.value || '') as PostStatusFilterValue)}
                aria-label="按帖子状态筛选"
              >
                {POST_STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value === '' ? 'all' : o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
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
                setStatusFilterInput('')
                setAppliedStatus('')
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
                  <TableHead className="w-32 font-medium text-foreground">作者</TableHead>
                  <TableHead className="min-w-[120px] max-w-[200px] font-medium text-foreground">
                    标题
                  </TableHead>
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
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((post) => (
                    <TableRow key={post.id} className="group transition-colors hover:bg-muted/50">
                      <TableCell className="text-muted-foreground">{post.id}</TableCell>
                      <TableCell
                        className="text-green-600 dark:text-green-400 font-bold"
                        title={post.authorDisplayName}
                      >
                        {post.authorDisplayName}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-foreground font-bold"
                        title={post.title}
                      >
                        {post.title || '—'}
                      </TableCell>
                      <TableCell
                        className="max-w-[260px] truncate text-muted-foreground"
                        title={post.excerpt || undefined}
                      >
                        {post.excerpt || '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{post.likeCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{post.commentCount}</TableCell>
                      <TableCell>
                        <PostStatusBadge status={post.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTime(post.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-md text-muted-foreground hover:text-primary"
                            aria-label="预览帖子"
                            onClick={() => setPreviewPostId(post.id)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`size-8 rounded-md text-muted-foreground ${
                              post.status === 3 ? 'hover:text-emerald-600' : 'hover:text-destructive'
                            }`}
                            aria-label={post.status === 3 ? '恢复帖子' : '删除帖子'}
                            title={post.status === 3 ? '恢复帖子' : '删除帖子'}
                            onClick={() => {
                              if (post.status === 3) {
                                setRestoreError(null)
                                setPostPendingRestore(post)
                                return
                              }
                              setDeleteError(null)
                              setPostPendingDelete(post)
                            }}
                          >
                            {post.status === 3 ? (
                              <RotateCcw className="size-4" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
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
              <span>
                共 <strong className="font-medium text-foreground">{total}</strong> 条记录
              </span>
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

      <AdminPostPreviewDialog postId={previewPostId} onClose={() => setPreviewPostId(null)} />

      {postPendingDelete ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 px-4"
          onClick={cancelDelete}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-post-title"
          >
            <h4 id="delete-post-title" className="text-base font-medium text-foreground">
              确认删除帖子
            </h4>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              将帖子标记为已删除后，小程序首页将不再展示该帖。确定删除「
              <span className="font-medium text-foreground">
                {postPendingDelete.title?.trim() || '无标题'}
              </span>
              」吗？
            </p>
            {deleteError ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-md"
                disabled={deleteSubmitting}
                onClick={cancelDelete}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="rounded-md"
                disabled={deleteSubmitting}
                onClick={() => void confirmDelete()}
              >
                {deleteSubmitting ? '删除中…' : '删除'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {postPendingRestore ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 px-4"
          onClick={cancelRestore}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-post-title"
          >
            <h4 id="restore-post-title" className="text-base font-medium text-foreground">
              确认恢复帖子
            </h4>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              恢复后该帖将重新回到已发布状态，并在小程序首页可见。确定恢复「
              <span className="font-medium text-foreground">
                {postPendingRestore.title?.trim() || '无标题'}
              </span>
              」吗？
            </p>
            {restoreError ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {restoreError}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-md"
                disabled={restoreSubmitting}
                onClick={cancelRestore}
              >
                取消
              </Button>
              <Button
                type="button"
                className="rounded-md"
                disabled={restoreSubmitting}
                onClick={() => void confirmRestore()}
              >
                {restoreSubmitting ? '恢复中…' : '恢复'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
