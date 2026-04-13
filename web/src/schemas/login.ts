import { z } from 'zod'

/**
 * 管理后台登录表单：字段与 POST /api/admin/auth/login 一致（username + password + remember）。
 */
export const loginFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, '请输入管理员用户名')
    .max(64, '用户名过长'),
  password: z
    .string()
    .min(1, '请输入密码')
    .min(6, '密码至少 6 位')
    .max(256, '密码过长'),
  remember: z.boolean(),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>
