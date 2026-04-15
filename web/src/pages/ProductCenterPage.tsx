import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X } from 'lucide-react'
import type { AdminProductListItem, CreateAdminProductBody } from '@/api/adminProducts'
import { createAdminProduct, deleteAdminProduct, fetchAdminProductList, updateAdminProduct } from '@/api/adminProducts'
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

type ProductStatusFilterValue = '' | '0' | '1'

const PRODUCT_STATUS_FILTER_OPTIONS: { value: ProductStatusFilterValue; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: '1', label: '上架' },
  { value: '0', label: '下架' },
]

interface CreateProductFormState {
  title: string
  price: string
  soldCount: string
  stock: string
  coverImage: string
  coverAspect: string
  detailImages: string[]
  description: string
  status: '0' | '1'
  sevenDayNoReason: boolean
}

const CREATE_FORM_INITIAL_STATE: CreateProductFormState = {
  title: '',
  price: '',
  soldCount: '0',
  stock: '0',
  coverImage: '',
  coverAspect: '1',
  detailImages: [],
  description: '',
  status: '1',
  sevenDayNoReason: false,
}

function ProductStatusBadge({ status }: { status: 0 | 1 }) {
  if (status === 1) {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:border-green-900/50 dark:bg-green-900/30 dark:text-green-400">
        上架
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-800/50 dark:bg-gray-800/30 dark:text-gray-400">
      下架
    </span>
  )
}

function SevenDayNoReasonBadge({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:border-green-900/50 dark:bg-green-900/30 dark:text-green-400">
        支持
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-800/50 dark:bg-gray-800/30 dark:text-gray-400">
      不支持
    </span>
  )
}

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN')
}

/**
 * 商品中心：按 mall_products 表结构展示商品列表，并支持后台新增商品。
 */
export function ProductCenterPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keywordInput, setKeywordInput] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [statusFilterInput, setStatusFilterInput] = useState<ProductStatusFilterValue>('')
  const [appliedStatus, setAppliedStatus] = useState<ProductStatusFilterValue>('')
  const [list, setList] = useState<AdminProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateProductFormState>(CREATE_FORM_INITIAL_STATE)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminProductListItem | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewTitle, setPreviewTitle] = useState('')
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const detailInputRef = useRef<HTMLInputElement | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  /** 列表封面图地址统一转为可直接展示的链接 */
  const resolveImageSrc = useCallback((raw: string) => {
    if (!raw) return ''
    if (raw.startsWith('data:image')) return raw
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    if (raw.startsWith('/')) return `${getApiBase()}${raw}`
    return `${getApiBase()}/${raw.replace(/^\/+/, '')}`
  }, [])

  /** 加载商品列表，支持分页和筛选 */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const json = await fetchAdminProductList({
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

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setAppliedKeyword(keywordInput.trim())
    setAppliedStatus(statusFilterInput)
    setPage(1)
  }

  /** 浏览器文件对象转 Base64 data URL，供前端预览与后端入库 */
  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
          return
        }
        reject(new Error('图片读取失败'))
      }
      reader.onerror = () => reject(new Error('图片读取失败'))
      reader.readAsDataURL(file)
    })
  }, [])

  /** 打开大图预览弹层，支持上一张/下一张切换 */
  const openPreview = useCallback(
    (images: string[], startIndex: number, title: string) => {
      if (!images.length) return
      setPreviewImages(images.map((img) => resolveImageSrc(img)))
      setPreviewIndex(Math.min(Math.max(0, startIndex), images.length - 1))
      setPreviewTitle(title)
    },
    [resolveImageSrc]
  )

  const resetCreateFormState = useCallback(() => {
    setCreateForm(CREATE_FORM_INITIAL_STATE)
    setCreateError(null)
    setEditingProductId(null)
  }, [])

  /** 提交新增/编辑商品，支持 Base64 图片提交。 */
  const handleCreateOrEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (createSubmitting) return
    setCreateError(null)

    const title = createForm.title.trim()
    const price = Number(createForm.price)
    const soldCount = Number(createForm.soldCount)
    const stock = Number(createForm.stock)
    const coverUrl = createForm.coverImage.trim()
    const coverAspect = Number(createForm.coverAspect)

    if (!title) {
      setCreateError('请填写商品标题')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setCreateError('商品价格必须为非负数')
      return
    }
    if (!Number.isInteger(soldCount) || soldCount < 0) {
      setCreateError('已售数量必须为非负整数')
      return
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setCreateError('库存必须为非负整数')
      return
    }
    if (!coverUrl) {
      setCreateError('请先选择封面图')
      return
    }
    if (!Number.isFinite(coverAspect) || coverAspect <= 0) {
      setCreateError('封面高宽比必须大于 0')
      return
    }

    const payloadBase: CreateAdminProductBody = {
      title,
      price,
      soldCount,
      stock,
      coverUrl,
      coverAspect,
      detailImages: createForm.detailImages,
      description: createForm.description.trim(),
      status: createForm.status === '0' ? 0 : 1,
      sevenDayNoReason: createForm.sevenDayNoReason,
    }

    setCreateSubmitting(true)
    try {
      const json =
        editingProductId === null
          ? await createAdminProduct(payloadBase)
          : await updateAdminProduct({
              id: editingProductId,
              ...payloadBase,
            })
      if (json.code !== 0) {
        setCreateError(json.message || (editingProductId === null ? '新增失败' : '编辑失败'))
        return
      }
      setCreateOpen(false)
      resetCreateFormState()
      setPage(1)
      await load()
    } catch {
      setCreateError(`网络错误，${editingProductId === null ? '新增失败' : '编辑失败'}`)
    } finally {
      setCreateSubmitting(false)
    }
  }

  /** 编辑商品：回填现有数据到弹窗，便于用户快速修改。 */
  const openEditDialog = useCallback((product: AdminProductListItem) => {
    setEditingProductId(product.id)
    setCreateError(null)
    setCreateForm({
      title: product.title,
      price: String(Number(product.price).toFixed(2)),
      soldCount: String(product.soldCount),
      stock: String(product.stock),
      coverImage: product.coverUrl,
      coverAspect: String(product.coverAspect),
      detailImages: product.detailImages ?? [],
      description: product.description ?? '',
      status: product.status === 0 ? '0' : '1',
      sevenDayNoReason: Boolean(product.sevenDayNoReason),
    })
    setCreateOpen(true)
  }, [])

  /** 删除商品：二次确认后调用后端删除接口并刷新列表。 */
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deleteSubmitting) return
    setDeleteSubmitting(true)
    setDeleteError(null)
    try {
      const json = await deleteAdminProduct(pendingDelete.id)
      if (json.code !== 0) {
        setDeleteError(json.message || '删除失败')
        return
      }
      setPendingDelete(null)
      await load()
    } catch {
      setDeleteError('网络错误，删除失败')
    } finally {
      setDeleteSubmitting(false)
    }
  }, [pendingDelete, deleteSubmitting, load])

  /** 选择封面图：读取为 Base64 后覆盖当前封面。 */
  const onPickCover = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        const dataUrl = await fileToDataUrl(file)
        setCreateForm((prev) => ({ ...prev, coverImage: dataUrl }))
      } finally {
        event.target.value = ''
      }
    },
    [fileToDataUrl]
  )

  /** 选择详情图：支持一次选多张并追加到详情图数组。 */
  const onPickDetails = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      if (!files.length) return
      try {
        const nextImages = await Promise.all(files.map((file) => fileToDataUrl(file)))
        setCreateForm((prev) => ({ ...prev, detailImages: [...prev.detailImages, ...nextImages] }))
      } finally {
        event.target.value = ''
      }
    },
    [fileToDataUrl]
  )

  const removeDetailImageAt = useCallback((index: number) => {
    setCreateForm((prev) => ({
      ...prev,
      detailImages: prev.detailImages.filter((_, i) => i !== index),
    }))
  }, [])

  const hasPreview = previewImages.length > 0
  const currentPreview = hasPreview ? previewImages[previewIndex] : ''

  const closeCreateDialog = useCallback(() => {
    if (createSubmitting) return
    setCreateOpen(false)
    resetCreateFormState()
  }, [createSubmitting, resetCreateFormState])

  return (
    <div className="admin-subpage">
      <Card className="bg-white rounded-[30px] border-none shadow-sm">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-2xl font-normal">商品中心</CardTitle>
          <CardDescription className="text-base">
            基于 mall_products 表结构展示商品基础信息，支持在后台快速新增商品。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form
            onSubmit={handleSearch}
            className="mb-6 flex flex-wrap items-center gap-3"
            role="search"
            aria-label="按商品搜索"
          >
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="输入商品标题或详情关键词搜索..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-8 rounded-md bg-transparent pl-9 pr-4"
                aria-label="商品搜索"
              />
            </div>
            <div className="flex min-w-[140px] flex-col gap-1 sm:max-w-[180px]">
              <label htmlFor="product-status-filter" className="sr-only">
                商品状态
              </label>
              <select
                id="product-status-filter"
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={statusFilterInput}
                onChange={(e) => setStatusFilterInput((e.target.value || '') as ProductStatusFilterValue)}
                aria-label="按商品状态筛选"
              >
                {PRODUCT_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value === '' ? 'all' : option.value} value={option.value}>
                    {option.label}
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
            <Button
              type="button"
              className="ml-auto h-8 rounded-md px-4"
              onClick={() => {
                setEditingProductId(null)
                setCreateForm(CREATE_FORM_INITIAL_STATE)
                setCreateError(null)
                setCreateOpen(true)
              }}
            >
              <Plus className="mr-1.5 size-4" />
              新增商品
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
                  <TableHead className="min-w-[220px] font-medium text-foreground">商品</TableHead>
                  <TableHead className="w-28 font-medium text-foreground text-right">价格</TableHead>
                  <TableHead className="w-20 font-medium text-foreground text-right">销量</TableHead>
                  <TableHead className="w-20 font-medium text-foreground text-right">库存</TableHead>
                  <TableHead className="w-24 font-medium text-foreground">状态</TableHead>
                  <TableHead className="w-24 font-medium text-foreground text-right">高宽比</TableHead>
                  <TableHead className="w-[220px] font-medium text-foreground">详情图</TableHead>
                  <TableHead className="w-24 font-medium text-foreground text-right">七天无理由</TableHead>
                  <TableHead className="w-44 font-medium text-foreground">创建时间</TableHead>
                  <TableHead className="w-44 font-medium text-foreground">更新时间</TableHead>
                  <TableHead className="w-28 font-medium text-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((item) => (
                    <TableRow key={item.id} className="group transition-colors hover:bg-muted/50">
                      <TableCell className="text-muted-foreground">{item.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.coverUrl ? (
                            <img
                              src={resolveImageSrc(item.coverUrl)}
                              alt={item.title}
                              className="size-10 shrink-0 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div className="size-10 shrink-0 rounded-md border border-dashed border-border bg-muted/40" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.description?.trim() || '无详情描述'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[#ff4400]">
                        ¥{Number(item.price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.soldCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.stock}</TableCell>
                      <TableCell>
                        <ProductStatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Number(item.coverAspect).toFixed(3)}
                      </TableCell>
                      <TableCell>
                        {item.detailImages.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {item.detailImages.slice(0, 3).map((img, index) => {
                              const remain = item.detailImages.length - 3
                              const isThird = index === 2
                              return (
                                <button
                                  type="button"
                                  key={`${item.id}-${index}`}
                                  className="relative size-10 overflow-hidden rounded-md border border-border"
                                  onClick={() => openPreview(item.detailImages, index, `${item.title} 详情图预览`)}
                                >
                                  <img
                                    src={resolveImageSrc(img)}
                                    alt={`${item.title} 详情图${index + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                  {isThird && remain > 0 ? (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-medium text-white">
                                      +{remain}
                                    </span>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <SevenDayNoReasonBadge enabled={item.sevenDayNoReason} />
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTime(item.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTime(item.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-md text-muted-foreground hover:text-primary"
                            title="编辑商品"
                            aria-label="编辑商品"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-md text-muted-foreground hover:text-destructive"
                            title="删除商品"
                            aria-label="删除商品"
                            onClick={() => {
                              setDeleteError(null)
                              setPendingDelete(item)
                            }}
                          >
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

      {createOpen ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 px-4"
          onClick={() => {
            closeCreateDialog()
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-product-title"
          >
            <h4 id="create-product-title" className="text-base font-medium text-foreground">
              {editingProductId === null ? '新增商品' : '编辑商品'}
            </h4>
            <p className="mt-2 text-sm text-muted-foreground">
              请手动选择封面图和详情图，页面会先 Base64 预览，保存时自动写入后端 image/test 目录。
            </p>

            <form onSubmit={(e) => void handleCreateOrEdit(e)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-foreground">商品标题</label>
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="请输入商品标题"
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground">价格（元）</label>
                <Input
                  value={createForm.price}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="例如 99.00"
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground">已售数量</label>
                <Input
                  value={createForm.soldCount}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, soldCount: e.target.value }))}
                  placeholder="例如 0"
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground">库存</label>
                <Input
                  value={createForm.stock}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, stock: e.target.value }))}
                  placeholder="例如 100"
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground">封面高宽比</label>
                <Input
                  value={createForm.coverAspect}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, coverAspect: e.target.value }))}
                  placeholder="例如 1.25"
                  className="h-9"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-foreground">封面图</label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickCover}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-md"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    选择封面图
                  </Button>
                  {createForm.coverImage ? (
                    <button
                      type="button"
                      className="relative size-14 overflow-hidden rounded-md border border-border"
                      onClick={() =>
                        openPreview([createForm.coverImage], 0, `${editingProductId === null ? '新增' : '编辑'}商品封面`)
                      }
                    >
                      <img src={resolveImageSrc(createForm.coverImage)} alt="封面预览" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">未选择封面图</span>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-foreground">详情图（可多选）</label>
                <input
                  ref={detailInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onPickDetails}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mb-2 h-9 rounded-md"
                  onClick={() => detailInputRef.current?.click()}
                >
                  选择详情图
                </Button>
                <div className="flex flex-wrap gap-2">
                  {createForm.detailImages.length === 0 ? (
                    <span className="text-xs text-muted-foreground">未选择详情图</span>
                  ) : (
                    createForm.detailImages.map((img, index) => (
                      <div key={`${img.slice(0, 24)}-${index}`} className="relative">
                        <button
                          type="button"
                          className="relative size-14 overflow-hidden rounded-md border border-border"
                          onClick={() =>
                            openPreview(createForm.detailImages, index, `${editingProductId === null ? '新增' : '编辑'}商品详情图`)
                          }
                        >
                          <img src={resolveImageSrc(img)} alt={`详情图${index + 1}`} className="h-full w-full object-cover" />
                        </button>
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-black/75 text-white"
                          onClick={() => removeDetailImageAt(index)}
                          aria-label={`删除第${index + 1}张详情图`}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-foreground">详情文案</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="请输入商品详情说明"
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground">商品状态</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  value={createForm.status}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, status: (e.target.value === '0' ? '0' : '1') as '0' | '1' }))
                  }
                >
                  <option value="1">上架</option>
                  <option value="0">下架</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={createForm.sevenDayNoReason}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, sevenDayNoReason: e.target.checked }))
                    }
                  />
                  支持七天无理由
                </label>
              </div>

              {createError ? (
                <p className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {createError}
                </p>
              ) : null}

              <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  disabled={createSubmitting}
                  onClick={closeCreateDialog}
                >
                  取消
                </Button>
                <Button type="submit" className="rounded-md" disabled={createSubmitting}>
                  {createSubmitting ? '提交中…' : editingProductId === null ? '确认新增' : '确认保存'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 px-4"
          onClick={() => {
            if (deleteSubmitting) return
            setPendingDelete(null)
            setDeleteError(null)
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
          >
            <h4 id="delete-product-title" className="text-base font-medium text-foreground">
              确认删除商品
            </h4>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              删除后商品将从列表移除。确定删除「
              <span className="font-medium text-foreground">{pendingDelete.title}</span>
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
                onClick={() => {
                  setPendingDelete(null)
                  setDeleteError(null)
                }}
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

      {hasPreview ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 px-4"
          onClick={() => setPreviewImages([])}
          role="presentation"
        >
          <div
            className="relative w-full max-w-5xl rounded-xl bg-black/70 p-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={previewTitle || '图片预览'}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
              onClick={() => setPreviewImages([])}
              aria-label="关闭预览"
            >
              <X className="size-4" />
            </button>
            <div className="mb-3 flex items-center justify-between px-1 text-sm text-white/90">
              <span>{previewTitle || '图片预览'}</span>
              <span>
                {previewIndex + 1} / {previewImages.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-md border-white/30 bg-transparent px-3 text-white hover:bg-white/10"
                onClick={() =>
                  setPreviewIndex((idx) => (idx - 1 + previewImages.length) % previewImages.length)
                }
              >
                上一张
              </Button>
              <div className="flex-1 overflow-hidden rounded-lg border border-white/20 bg-black/50">
                <img
                  src={currentPreview}
                  alt={`预览图${previewIndex + 1}`}
                  className="mx-auto max-h-[70vh] w-auto object-contain"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-md border-white/30 bg-transparent px-3 text-white hover:bg-white/10"
                onClick={() => setPreviewIndex((idx) => (idx + 1) % previewImages.length)}
              >
                下一张
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
