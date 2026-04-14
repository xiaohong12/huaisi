import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AdminOrderWorkflowStatus } from '@/api/adminOrders'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export interface ChangeOrderStatusOrder {
  id: number
  orderNo: string
  status: AdminOrderWorkflowStatus
}

const STATUS_OPTIONS: { value: AdminOrderWorkflowStatus; label: string }[] = [
  { value: 'pending', label: '待付款' },
  { value: 'paid', label: '已付款' },
  { value: 'shipped', label: '已发货' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

interface ChangeOrderStatusDialogProps {
  open: boolean
  order: ChangeOrderStatusOrder | null
  /** 提交修改：由父组件调用接口；失败时抛错或返回 rejected Promise，弹窗展示 message */
  onSubmit: (nextStatus: AdminOrderWorkflowStatus, reason: string) => Promise<void>
  onClose: () => void
}

/**
 * 修改订单流程状态：必选目标状态，变更理由使用多行文本（必填），提交后由父组件持久化。
 */
export function ChangeOrderStatusDialog({ open, order, onSubmit, onClose }: ChangeOrderStatusDialogProps) {
  const [nextStatus, setNextStatus] = useState<AdminOrderWorkflowStatus>('pending')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !order) return
    setNextStatus(order.status)
    setReason('')
    setFormError(null)
    setSubmitting(false)
  }, [open, order?.id, order?.status])

  const handleSubmit = useCallback(async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setFormError('请填写变更理由')
      return
    }
    if (trimmed.length > 2000) {
      setFormError('理由请勿超过 2000 字')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      await onSubmit(nextStatus, trimmed)
      onClose()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }, [reason, nextStatus, onSubmit, onClose])

  if (!open || !order) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="修改订单状态"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-foreground">修改订单状态</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              订单号 <span className="font-mono text-foreground">{order.orderNo}</span>
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="size-4" />
          </Button>
        </div>

        {formError ? (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="order-workflow-status">
              目标状态
            </label>
            <select
              id="order-workflow-status"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as AdminOrderWorkflowStatus)}
              disabled={submitting}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="order-status-reason">
              变更理由（必填）
            </label>
            <Textarea
              id="order-status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明修改原因，将写入审计日志…"
              maxLength={2000}
              disabled={submitting}
              rows={4}
              className="rounded-md"
              aria-invalid={Boolean(formError && !reason.trim())}
            />
            <p className="text-right text-xs text-muted-foreground">{reason.length}/2000</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-9 rounded-md" disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button type="button" className="h-9 rounded-md" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}
