import { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getApiBase } from './config'
import { loginFormSchema, type LoginFormValues } from './schemas/login'
import './App.css'

interface AdminLoginResponse {
  code: number
  message: string
  data: {
    token: string
    expiresAt: string
    admin: { id: number; username: string; displayName: string }
  } | null
}

/**
 * 管理端登录页：左侧为「华思」项目简介，右侧为管理员登录（React Hook Form + Zod，对接 /api/admin/auth/login）。
 */
/** 密码可见性图标：与小程序 eye.png / eye-closed.png 语义一致（明文=睁眼，密文=闭眼） */
function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
      />
      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function App() {
  const [apiError, setApiError] = useState<string | null>(null)
  const [loginOk, setLoginOk] = useState(false)
  /** 与小程序 phone-password.vue：passwordVisible 为 true 时明文 */
  const [passwordVisible, setPasswordVisible] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
      remember: false,
    },
    mode: 'onTouched',
  })

  const onValidSubmit: SubmitHandler<LoginFormValues> = async (data) => {
    setApiError(null)
    setLoginOk(false)
    try {
      const res = await fetch(`${getApiBase()}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          remember: data.remember,
        }),
      })
      const json = (await res.json()) as AdminLoginResponse
      if (json.code !== 0 || !json.data?.token) {
        setApiError(json.message || '登录失败')
        return
      }
      const storage = data.remember ? window.localStorage : window.sessionStorage
      window.localStorage.removeItem('admin_token')
      window.sessionStorage.removeItem('admin_token')
      storage.setItem('admin_token', json.data.token)
      setLoginOk(true)
      // 后续接入后台首页路由后在此跳转
    } catch {
      setApiError('网络异常，请稍后重试')
    }
  }

  return (
    <div className="login-page" lang="zh-CN">
      <div className="login-page__intro" aria-label="项目简介">
        <div className="login-page__intro-inner">
          <p className="login-page__eyebrow">华思 · 管理后台</p>
          <h1 className="login-page__display">统一运营与数据视图</h1>
          <p className="login-page__lead">
            本仓库包含三部分：<strong>server</strong>（Node.js 后端）、
            <strong>fontproject</strong>（UniApp 微信小程序端）、以及当前
            <strong> web </strong>
            PC 管理端。在此登录后，可对业务与用户侧能力进行配置与监控。
          </p>
          <ul className="login-page__bullets">
            <li>后端接口与资源由 server 提供，便于扩展与部署。</li>
            <li>小程序端与后台共用业务模型，减少重复维护。</li>
            <li>本后台面向运营与管理员，强调清晰结构与可控操作路径。</li>
          </ul>
        </div>
      </div>

      <div className="login-page__panel">
        <div className="login-page__panel-inner">
          <header className="login-page__form-header">
            <span className="login-page__brand-mark" aria-hidden="true" />
            <div>
              <h2 className="login-page__form-title">登录</h2>
              <p className="login-page__form-sub">使用管理员账号进入后台</p>
            </div>
          </header>

          <form
            className="login-form"
            onSubmit={handleSubmit(onValidSubmit)}
            noValidate
          >
            {apiError ? (
              <p className="login-form__api-error" role="alert">
                {apiError}
              </p>
            ) : null}
            {loginOk ? (
              <p className="login-form__api-success" role="status">
                登录成功，已保存凭证；后台工作台接入后可从此进入。
              </p>
            ) : null}

            <div className="login-form__field">
              <label className="login-form__label" htmlFor="login-username">
                管理员用户名
              </label>
              <input
                id="login-username"
                className={`login-form__input${errors.username ? ' login-form__input--error' : ''}`}
                type="text"
                autoComplete="username"
                placeholder="管理员登录名"
                aria-invalid={errors.username ? 'true' : 'false'}
                aria-describedby={errors.username ? 'login-username-error' : undefined}
                {...register('username')}
              />
              {errors.username ? (
                <p id="login-username-error" className="login-form__error" role="alert">
                  {errors.username.message}
                </p>
              ) : null}
            </div>

            <div className="login-form__field">
              <label className="login-form__label" htmlFor="login-password">
                密码
              </label>
              <div className="login-form__password-wrap">
                <input
                  id="login-password"
                  className={`login-form__input login-form__input--with-toggle${
                    errors.password ? ' login-form__input--error' : ''
                  }`}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  {...register('password')}
                  type={passwordVisible ? 'text' : 'password'}
                />
                <button
                  type="button"
                  className="login-form__pwd-toggle"
                  aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((v) => !v)}
                >
                  <PasswordVisibilityIcon visible={passwordVisible} />
                </button>
              </div>
              {errors.password ? (
                <p id="login-password-error" className="login-form__error" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {/* <label className="login-form__remember">
              <input type="checkbox" {...register('remember')} />
              <span>在此设备上记住登录状态</span>
            </label> */}

            <button
              type="submit"
              className="login-form__submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? '提交中…' : '进入后台'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
