"use client"

import { useState, useEffect, useTransition } from "react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor, User, Lock, Palette, Bell, Boxes, Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { savePreferencias } from "@/app/actions/preferencias"
import {
  ITENS_POR_PAGINA_OPCOES,
  LOJAS,
  type PreferenciasInput,
} from "@/lib/preferencias"
import { ESPERA_TIPOS, ESPERA_TIPO_LABELS, type EsperaTipo } from "@/lib/espera"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Props = {
  user: { name: string; username: string; role: string }
  preferencias: PreferenciasInput
}

export function ConfiguracoesManager({ user, preferencias }: Props) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PerfilCard user={user} />
      <SegurancaCard />
      <AparenciaCard />
      <PreferenciasCard inicial={preferencias} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------
function PerfilCard({ user }: { user: Props["user"] }) {
  const [nome, setNome] = useState(user.name)
  const [pending, startTransition] = useTransition()

  const alterado = nome.trim() !== user.name && nome.trim().length > 0
  const inicial = (user.name || user.username || "?")[0]?.toUpperCase()

  function salvar() {
    startTransition(async () => {
      const { error } = await authClient.updateUser({ name: nome.trim() })
      if (error) {
        toast.error(error.message ?? "Não foi possível atualizar o perfil.")
        return
      }
      toast.success("Perfil atualizado.")
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Perfil</CardTitle>
        </div>
        <CardDescription>Suas informações de identificação no sistema.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="app-user-avatar h-12 w-12 text-base" aria-hidden="true">
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{user.name || user.username}</p>
            <p className="text-xs text-muted-foreground">{user.role}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="perfil-nome">Nome de exibição</Label>
            <Input
              id="perfil-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="perfil-usuario">Usuário</Label>
            <Input id="perfil-usuario" value={user.username} disabled readOnly />
            <p className="text-xs text-muted-foreground">O nome de usuário é definido pelo administrador.</p>
          </div>
        </div>

        <div>
          <Button onClick={salvar} disabled={!alterado || pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Salvar perfil
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Segurança
// ---------------------------------------------------------------------------
function SegurancaCard() {
  const [atual, setAtual] = useState("")
  const [nova, setNova] = useState("")
  const [confirma, setConfirma] = useState("")
  const [revogar, setRevogar] = useState(true)
  const [pending, startTransition] = useTransition()

  const podeSalvar = atual.length >= 1 && nova.length >= 8 && confirma.length >= 1

  function salvar() {
    if (nova !== confirma) {
      toast.error("A nova senha e a confirmação não coincidem.")
      return
    }
    if (nova.length < 8) {
      toast.error("A nova senha deve ter ao menos 8 caracteres.")
      return
    }
    startTransition(async () => {
      const { error } = await authClient.changePassword({
        currentPassword: atual,
        newPassword: nova,
        revokeOtherSessions: revogar,
      })
      if (error) {
        toast.error(error.message ?? "Não foi possível alterar a senha. Verifique a senha atual.")
        return
      }
      toast.success("Senha alterada com sucesso.")
      setAtual("")
      setNova("")
      setConfirma("")
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Segurança</CardTitle>
        </div>
        <CardDescription>Altere sua senha de acesso.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="senha-atual">Senha atual</Label>
            <Input
              id="senha-atual"
              type="password"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha-nova">Nova senha</Label>
            <Input
              id="senha-nova"
              type="password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              autoComplete="new-password"
              placeholder="Mín. 8 caracteres"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha-confirma">Confirmar nova senha</Label>
            <Input
              id="senha-confirma"
              type="password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <label className="flex items-center gap-3">
          <Switch checked={revogar} onCheckedChange={setRevogar} />
          <span className="text-sm text-muted-foreground">
            Encerrar sessões em outros dispositivos ao trocar a senha
          </span>
        </label>

        <div>
          <Button onClick={salvar} disabled={!podeSalvar || pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Alterar senha
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Aparência (tema via next-themes)
// ---------------------------------------------------------------------------
function AparenciaCard() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const opcoes = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ] as const

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Aparência</CardTitle>
        </div>
        <CardDescription>Escolha o tema da interface. A alteração é aplicada na hora.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Tema da interface">
          {opcoes.map((o) => {
            const Icon = o.icon
            const ativo = mounted && theme === o.value
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setTheme(o.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                  ativo
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-5 w-5" />
                {o.label}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Preferências (notificações + padrões de estoque) — salvas juntas
// ---------------------------------------------------------------------------
function PreferenciasCard({ inicial }: { inicial: PreferenciasInput }) {
  const [prefs, setPrefs] = useState<PreferenciasInput>(inicial)
  const [pending, startTransition] = useTransition()

  function set<K extends keyof PreferenciasInput>(key: K, value: PreferenciasInput[K]) {
    setPrefs((p) => ({ ...p, [key]: value }))
  }

  function salvar() {
    startTransition(async () => {
      const res = await savePreferencias(prefs)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Preferências salvas.")
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Notificações</CardTitle>
        </div>
        <CardDescription>Alertas exibidos no painel do sistema.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ToggleLinha
          titulo="Estoque baixo"
          descricao="Avisar quando um item atingir o mínimo definido."
          checked={prefs.notifEstoqueBaixo}
          onChange={(v) => set("notifEstoqueBaixo", v)}
        />
        <ToggleLinha
          titulo="Nova garantia"
          descricao="Avisar quando um vendedor abrir uma solicitação de garantia."
          checked={prefs.notifNovaGarantia}
          onChange={(v) => set("notifNovaGarantia", v)}
        />
        <ToggleLinha
          titulo="Resumo diário"
          descricao="Receber um resumo das movimentações do dia."
          checked={prefs.notifResumoDiario}
          onChange={(v) => set("notifResumoDiario", v)}
        />

        <Separator />

        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Padrões de estoque</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref-alerta">Alerta de estoque mínimo</Label>
            <Input
              id="pref-alerta"
              type="number"
              min={0}
              value={prefs.estoqueAlertaMinimo}
              onChange={(e) => set("estoqueAlertaMinimo", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Abaixo desta quantidade, o item é sinalizado.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref-itens">Itens por página</Label>
            <Select
              value={String(prefs.itensPorPagina)}
              onValueChange={(v) => set("itensPorPagina", Number(v))}
            >
              <SelectTrigger id="pref-itens">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITENS_POR_PAGINA_OPCOES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} itens
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref-espera">Embalagem padrão na espera</Label>
            <Select
              value={prefs.esperaTipoPadrao}
              onValueChange={(v) => set("esperaTipoPadrao", v)}
            >
              <SelectTrigger id="pref-espera">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESPERA_TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ESPERA_TIPO_LABELS[t as EsperaTipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref-loja">Loja padrão nas garantias</Label>
            <Select
              value={prefs.garantiaLojaPadrao ?? "nenhuma"}
              onValueChange={(v) => set("garantiaLojaPadrao", v === "nenhuma" ? null : v)}
            >
              <SelectTrigger id="pref-loja">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                {LOJAS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Button onClick={salvar} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Salvar preferências
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ToggleLinha({
  titulo,
  descricao,
  checked,
  onChange,
}: {
  titulo: string
  descricao: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        <p className="text-xs text-muted-foreground text-pretty">{descricao}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  )
}
