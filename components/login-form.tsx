"use client"

import type React from "react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { authClient } from "@/lib/auth-client"
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Moon, ShieldCheck, Sun } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    const { error } = await authClient.signIn.username({
      username: username.trim(),
      password,
    })

    if (error) {
      setError("Não foi possível entrar. Verifique suas credenciais.")
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <main className="login-shell font-sans">
      <header className="login-header">
        <div className="login-brand" aria-label="NuneDiesel Autopeças">
          <Image src="/nune-logo.png" alt="" width={52} height={34} className="login-brand-mark brand-logo" priority />
          <div>
            <p className="login-brand-name">NuneDiesel</p>
            <p className="login-brand-detail">Autopeças</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="login-environment">
            <span className="login-environment-dot" aria-hidden="true" />
            Ambiente interno
          </div>
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="login-theme-toggle"
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <section className="login-stage">
        <div className="login-brand-panel" aria-hidden="true">
          <div className="login-orbit login-orbit-outer" />
          <div className="login-orbit login-orbit-inner" />
          <div className="login-technical-grid" />
          <div className="login-serial">ND / 01</div>

          <div className="login-brand-copy">
            <span className="login-eyebrow">
              <i /> Operação de entrada
            </span>
            <h1>
              Precisão que
              <br />
              mantém tudo
              <br />
              <strong>em movimento.</strong>
            </h1>
            <p>Conferência de NF-e, vinculação de produtos e controle de entrada em um fluxo único.</p>
          </div>

          <div className="login-specs">
            <div>
              <b>NF-e</b>
              <span>Conferência</span>
            </div>
            <div>
              <b>SKU</b>
              <span>Vinculação</span>
            </div>
            <div>
              <b>24/7</b>
              <span>Operação</span>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-wrap">
            <div className="login-form-icon" aria-hidden="true">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </div>
            <div className="login-form-heading">
              <p className="login-kicker">Acesso ao sistema</p>
              <h2>Bem-vindo de volta.</h2>
              <p>Use suas credenciais para continuar sua operação.</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="username">Usuário</label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  aria-invalid={Boolean(error)}
                  placeholder="Digite seu usuário"
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">Senha</label>
                <div className="login-password-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-invalid={Boolean(error)}
                    placeholder="Digite sua senha"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-error" role="alert">
                  <span aria-hidden="true">!</span>
                  <p>{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="login-submit">
                <span>{loading ? "Autenticando" : "Entrar no sistema"}</span>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              </button>
            </form>

            <div className="login-security">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Sessão protegida e acesso restrito</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="login-footer">
        <span>NuneDiesel Autopeças</span>
        <span>Conferência NF-e · v2.0</span>
      </footer>
    </main>
  )
}
