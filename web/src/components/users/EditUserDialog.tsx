import { useRef, type ChangeEvent, type FormEvent } from 'react'
import { User } from 'lucide-react'
import type { AdminUserListItem } from '@/api/adminUsers'
import { getApiBase } from '@/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface EditUserDialogProps {
  user: AdminUserListItem | null
  username: string
  nickname: string
  avatar: string
  avatarPreview: string
  gender: 'male' | 'female' | 'unknown'
  phone: string
  status: 0 | 1
  saving: boolean
  error: string | null
  fieldErrors: {
    username?: string
    nickname?: string
    phone?: string
  }
  onUsernameChange: (value: string) => void
  onNicknameChange: (value: string) => void
  onAvatarFileSelect: (file: File, base64: string) => void
  onGenderChange: (value: 'male' | 'female' | 'unknown') => void
  onPhoneChange: (value: string) => void
  onToggleStatus: () => void
  onClose: () => void
  onSubmit: (e: FormEvent) => void
}

/**
 * 用户编辑弹框：集中维护编辑表单，便于页面复用与主页面瘦身。
 */
export function EditUserDialog({
  user,
  username,
  nickname,
  avatar,
  avatarPreview,
  gender,
  phone,
  status,
  saving,
  error,
  fieldErrors,
  onUsernameChange,
  onNicknameChange,
  onAvatarFileSelect,
  onGenderChange,
  onPhoneChange,
  onToggleStatus,
  onClose,
  onSubmit,
}: EditUserDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!user) {
    return null
  }

  const disabled = saving
  const avatarDisplay = avatarPreview.trim()
    ? avatarPreview
    : avatar.trim()
    ? avatar.startsWith('/')
      ? `${getApiBase()}${avatar}`
      : avatar
    : ''

  const handleSelectAvatarClick = () => {
    if (disabled) {
      return
    }
    fileInputRef.current?.click()
  }

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = typeof reader.result === 'string' ? reader.result : ''
      if (base64) {
        onAvatarFileSelect(file, base64)
      }
      e.target.value = ''
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-xl rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-medium text-foreground">编辑用户</h3>
          <span className="text-sm text-muted-foreground">ID: {user.id}</span>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <label className="text-sm text-foreground">头像</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAvatarClick}
                disabled={disabled}
                className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-border bg-muted transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="点击选择头像图片"
                title="点击更换头像"
              >
                {avatarDisplay ? (
                  <img src={avatarDisplay} alt="avatar-preview" className="size-full object-cover" />
                ) : (
                  <User className="size-5 text-muted-foreground" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground" htmlFor="edit-username">
              用户名
            </label>
            <Input
              id="edit-username"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              maxLength={64}
              className={`h-9 ${fieldErrors.username ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
              placeholder="请输入用户名"
              disabled={disabled}
            />
            {fieldErrors.username ? <p className="text-xs !text-destructive">{fieldErrors.username}</p> : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground" htmlFor="edit-nickname">
              昵称
            </label>
            <Input
              id="edit-nickname"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              maxLength={64}
              className={`h-9 ${fieldErrors.nickname ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
              placeholder="请输入昵称"
              disabled={disabled}
            />
            {fieldErrors.nickname ? <p className="text-xs text-destructive!">{fieldErrors.nickname}</p> : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground" htmlFor="edit-phone">
              手机号
            </label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              maxLength={20}
              className={`h-9 ${fieldErrors.phone ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
              placeholder="可留空"
              disabled={disabled}
            />
            {fieldErrors.phone ? <p className="text-xs text-destructive!">{fieldErrors.phone}</p> : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground" htmlFor="edit-gender">
              性别
            </label>
            <select
              id="edit-gender"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={gender}
              onChange={(e) => onGenderChange(e.target.value as 'male' | 'female' | 'unknown')}
              disabled={disabled}
            >
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="unknown">未知</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-foreground" htmlFor="edit-status">
              用户状态
            </label>
            <div className="flex items-center gap-3">
              <button
                id="edit-status"
                type="button"
                role="switch"
                aria-checked={status === 1}
                aria-label="切换用户状态"
                disabled={disabled}
                onClick={onToggleStatus}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  status === 1 ? 'bg-emerald-500' : 'bg-gray-400'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    status === 1 ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm ${status === 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {status === 1 ? '激活' : '拉黑'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className="h-9 px-5" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" className="h-9 px-5" disabled={disabled}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
