import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bookmark, Heart, MessageCircle, Share2, X } from 'lucide-react'
import type { AdminPostDetail, AdminPostDetailComment } from '@/api/adminPosts'
import { fetchAdminPostDetail } from '@/api/adminPosts'
import { getApiBase } from '@/config'
import { Button } from '@/components/ui/button'

const AVATAR_GRADS = [
  'linear-gradient(135deg,#c7d2fe 0%,#6366f1 100%)',
  'linear-gradient(135deg,#fde68a 0%,#f59e0b 100%)',
  'linear-gradient(135deg,#bbf7d0 0%,#22c55e 100%)',
  'linear-gradient(135deg,#fbcfe8 0%,#ec4899 100%)',
]

function avatarGradient(nickname: string): string {
  let h = 0
  for (let i = 0; i < nickname.length; i += 1) {
    h = (h + nickname.charCodeAt(i) * (i + 1)) % AVATAR_GRADS.length
  }
  return AVATAR_GRADS[h]
}

function sectionTagStyle(sectionName: string): { tagBg: string; tagColor: string } {
  if (sectionName.includes('电影')) {
    return { tagBg: 'rgba(59,130,246,0.12)', tagColor: '#2563eb' }
  }
  if (sectionName.includes('动漫') || sectionName.includes('协会')) {
    return { tagBg: 'rgba(249,115,22,0.12)', tagColor: '#ea580c' }
  }
  return { tagBg: 'rgba(139,92,246,0.12)', tagColor: '#7c3aed' }
}

function isHttpOrDataImage(src: string): boolean {
  return /^https?:\/\//i.test(src) || /^data:image\//i.test(src)
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

function resolveAvatarSrc(raw: string): string {
  if (!raw) return ''
  if (raw.startsWith('data:image') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw
  }
  if (raw.startsWith('/')) return `${getApiBase()}${raw}`
  return `${getApiBase()}/${raw.replace(/^\/+/, '')}`
}

function replyTargetNickname(c: AdminPostDetailComment): string {
  return c.replyToNickname?.trim() || '用户'
}

interface AdminPostPreviewDialogProps {
  postId: number | null
  onClose: () => void
}

/**
 * 管理端帖子预览弹窗：布局参考小程序 PostCard；有评论时才展示评论区块，发布时间在作者信息下方。
 */
export function AdminPostPreviewDialog({ postId, onClose }: AdminPostPreviewDialogProps) {
  const open = postId != null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [post, setPost] = useState<AdminPostDetail | null>(null)
  const [comments, setComments] = useState<AdminPostDetailComment[]>([])

  const load = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    setPost(null)
    setComments([])
    try {
      const json = await fetchAdminPostDetail(id)
      if (json.code !== 0 || !json.data) {
        setError(json.message || '加载失败')
        return
      }
      setPost(json.data.post)
      setComments(json.data.comments)
    } catch {
      setError('网络错误，请检查后端是否启动')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || postId == null) {
      setPost(null)
      setComments([])
      setError(null)
      setLoading(false)
      return
    }
    void load(postId)
  }, [open, postId, load])

  const displayImages = useMemo(() => {
    if (!post?.imageUrls?.length) {
      return [] as string[]
    }
    return post.imageUrls
  }, [post?.imageUrls])

  const isSingleImage = displayImages.length === 1
  const nick = post?.nickname?.trim() || '用户'
  const letter = nick.slice(0, 1) || '?'
  const tag = post?.sectionName?.trim() || '帖子'
  const { tagBg, tagColor } = sectionTagStyle(tag)
  const avatarSrc = post?.avatar ? resolveAvatarSrc(post.avatar) : ''

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="帖子预览"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg font-medium text-foreground">帖子详情</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-md text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
          ) : error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : post ? (
            <article className="rounded-2xl bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                {avatarSrc && isHttpOrDataImage(avatarSrc) ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    className="size-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ background: avatarGradient(nick) }}
                  >
                    {letter}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-foreground">{nick}</span>
                    <span
                      className="rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight"
                      style={{ background: tagBg, color: tagColor }}
                    >
                      {tag}
                    </span>
                  </div>
                  <p className=" text-xs text-muted-foreground mt-2!">
                    {formatTime(post.createdAt)}
                  </p>
                </div>
              </div>

              <h4 className="mt-4 text-lg font-bold leading-snug text-foreground">{post.title}</h4>
              <div className="mt-2 whitespace-pre-wrap wrap-break-word text-[15px] leading-relaxed text-muted-foreground">
                {post.content || '（无正文）'}
              </div>

              {displayImages.length > 0 ? (
                <div
                  className={
                    isSingleImage
                      ? 'mt-4 flex flex-col items-start'
                      : 'mt-4 flex flex-row gap-3'
                  }
                >
                  {displayImages.map((src, idx) => (
                    <div
                      key={`${idx}-${src.slice(0, 32)}`}
                      className={
                        isSingleImage
                          ? 'w-1/2 max-w-[240px] overflow-hidden rounded-2xl border border-border/60'
                          : 'h-36 min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60'
                      }
                    >
                      {isHttpOrDataImage(src) ? (
                        <img
                          src={src}
                          alt=""
                          className={
                            isSingleImage
                              ? 'block h-auto w-full object-contain'
                              : 'size-full object-cover'
                          }
                        />
                      ) : (
                        <div
                          className={
                            isSingleImage ? 'h-24 w-full bg-muted' : 'size-full bg-muted'
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="mt-4 h-24 w-full rounded-2xl bg-linear-to-br from-muted to-muted/60"
                  aria-hidden
                />
              )}

              <div className="mt-5 flex items-center justify-between border-t border-[#f3f4f6] px-2 pt-4 text-muted-foreground">
                <div className="flex items-center gap-1.5 text-sm">
                  <MessageCircle className="size-5 opacity-60" aria-hidden />
                  <span>{post.commentCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Heart className="size-5 opacity-60" aria-hidden />
                  <span>{post.likeCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Bookmark className="size-5 opacity-60" aria-hidden />
                  <span>{post.favoriteCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm opacity-60">
                  <Share2 className="size-5" aria-hidden />
                </div>
              </div>

              {comments.length > 0 ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                  <ul className="divide-y divide-border/80">
                    {comments.map((c) => (
                      <li key={c.id} className="py-2.5 text-sm leading-relaxed">
                        {c.parentId != null ? (
                          <>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {c.nickname?.trim() || '用户'}
                            </span>
                            <span className="text-muted-foreground"> 回复了 </span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {replyTargetNickname(c)}
                            </span>
                            <span className="text-muted-foreground">：</span>
                            <span className="text-foreground">{c.content}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {formatTime(c.createdAt)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {c.nickname?.trim() || '用户'}
                            </span>
                            <span className="text-muted-foreground">：</span>
                            <span className="text-foreground">{c.content}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {formatTime(c.createdAt)}
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ) : null}
        </div>
      </div>
    </div>
  )
}
