import { useCallback, useEffect, useState } from 'react'
import { Search, User, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AdminUserListItem } from '@/api/adminUsers'
import { fetchAdminUserList, updateAdminUser, uploadAdminUserAvatar } from '@/api/adminUsers'
import { getApiBase } from '@/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditUserDialog } from '@/components/users/EditUserDialog'
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

function UserStatusBadge({ status }: { status: number }) {
  if (status === 1) {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-400">
        激活
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400">
      拉黑
    </span>
  )
}

/**
 * 手机号校验：允许为空；有值时必须是中国大陆 11 位手机号（1 开头）。
 */
function isValidMainlandPhone(phone: string): boolean {
  if (!phone) return true
  return /^1\d{10}$/.test(phone)
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
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [editAvatarPreview, setEditAvatarPreview] = useState('')
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null)
  const [editGender, setEditGender] = useState<'male' | 'female' | 'unknown'>('unknown')
  const [editPhone, setEditPhone] = useState('')
  const [editStatus, setEditStatus] = useState<0 | 1>(1)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string
    nickname?: string
    phone?: string
  }>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const json = await fetchAdminUserList({
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

  const openEditDialog = (user: AdminUserListItem) => {
    setEditingUser(user)
    setEditUsername(user.username || '')
    setEditNickname(user.nickname || '')
    setEditAvatar(user.avatar || '')
    setEditAvatarPreview('')
    setEditAvatarFile(null)
    setEditGender(user.gender === 'male' || user.gender === 'female' ? user.gender : 'unknown')
    setEditPhone(user.phone || '')
    setEditStatus(user.status === 1 ? 1 : 0)
    setEditError(null)
    setFieldErrors({})
  }

  const closeEditDialog = () => {
    if (saving) {
      return
    }
    setEditingUser(null)
    setEditError(null)
    setFieldErrors({})
    setEditAvatarPreview('')
    setEditAvatarFile(null)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) {
      return
    }
    const username = editUsername.trim()
    const nickname = editNickname.trim()
    let avatar = editAvatar.trim()
    const phone = editPhone.trim()
    if (!username) {
      setFieldErrors({ username: '用户名不能为空' })
      return
    }
    if (!nickname) {
      setFieldErrors({ nickname: '昵称不能为空' })
      return
    }
    if (!isValidMainlandPhone(phone)) {
      setFieldErrors({ phone: '手机号格式不正确，请输入 11 位大陆手机号' })
      return
    }
    setSaving(true)
    setEditError(null)
    setFieldErrors({})
    try {
      if (editAvatarFile) {
        const uploadRes = await uploadAdminUserAvatar(editAvatarFile)
        if (uploadRes.code !== 0 || !uploadRes.data?.fileName) {
          setEditError(uploadRes.message || '头像上传失败')
          return
        }
        avatar = `/image/test/${uploadRes.data.fileName}`
      }

      const json = await updateAdminUser(editingUser.id, {
        username,
        nickname,
        avatar,
        gender: editGender,
        phone: phone || null,
        status: editStatus,
      })
      if (json.code !== 0 || !json.data) {
        const msg = json.message || '保存失败'
        if (
          msg.includes('手机号格式不正确') ||
          msg.includes('手机号已被其他用户使用') ||
          msg.includes('手机号')
        ) {
          setFieldErrors({ phone: msg })
          setEditError(null)
        } else if (msg.includes('用户名')) {
          setFieldErrors({ username: msg })
          setEditError(null)
        } else if (msg.includes('昵称')) {
          setFieldErrors({ nickname: msg })
          setEditError(null)
        } else {
          setEditError(msg)
        }
        return
      }
      setList((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                username,
                nickname,
                avatar,
                gender: editGender,
                phone: phone || null,
                status: editStatus,
              }
            : u
        )
      )
      setEditingUser(null)
      setEditAvatarPreview('')
      setEditAvatarFile(null)
    } catch {
      setEditError('网络错误，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectAvatarFile = (file: File, base64: string) => {
    setEditAvatarFile(file)
    setEditAvatarPreview(base64)
  }

  const handleUsernameChange = (value: string) => {
    setEditUsername(value)
    setFieldErrors((prev) => ({ ...prev, username: undefined }))
  }

  const handleNicknameChange = (value: string) => {
    setEditNickname(value)
    setFieldErrors((prev) => ({ ...prev, nickname: undefined }))
  }

  const handlePhoneChange = (value: string) => {
    setEditPhone(value)
    setFieldErrors((prev) => ({ ...prev, phone: undefined }))
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
            aria-label="按用户名、昵称、手机号搜索"
          >
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="输入用户名/昵称/手机号搜索..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-8 rounded-md bg-transparent pl-9 pr-4"
                aria-label="用户名昵称手机号搜索"
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
                  <TableHead className="font-medium text-foreground">状态</TableHead>
                  <TableHead className="font-medium text-foreground">注册时间</TableHead>
                  <TableHead className="w-32 text-right font-medium text-foreground">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
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
                      <TableCell>
                        <UserStatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTime(u.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-md px-3"
                          onClick={() => openEditDialog(u)}
                        >
                          编辑
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

      <EditUserDialog
        user={editingUser}
        username={editUsername}
        nickname={editNickname}
        avatar={editAvatar}
        avatarPreview={editAvatarPreview}
        gender={editGender}
        phone={editPhone}
        status={editStatus}
        saving={saving}
        error={editError}
        fieldErrors={fieldErrors}
        onUsernameChange={handleUsernameChange}
        onNicknameChange={handleNicknameChange}
        onAvatarFileSelect={handleSelectAvatarFile}
        onGenderChange={setEditGender}
        onPhoneChange={handlePhoneChange}
        onToggleStatus={() => setEditStatus((prev) => (prev === 1 ? 0 : 1))}
        onClose={closeEditDialog}
        onSubmit={handleSaveEdit}
      />
    </div>
  )
}
