"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { abrirGarantia, type NovaGarantiaInput } from "@/app/actions/garantias"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { User, Package, Gauge, FileWarning, Loader2, Send } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const EMPTY: NovaGarantiaInput = {
  clienteNome: "",
  clienteContato: "",
  clienteFone: "",
  clienteEmail: "",
  notaNumero: "",
  dataCompra: "",
  loja: "",
  pecaNumero: "",
  produtoDescricao: "",
  pecaMarca: "",
  veiculo: "",
  anoModelo: "",
  motor: "",
  kmInicial: "",
  kmDefeito: "",
  kmRodado: "",
  horasRodadas: "",
  dataAplicacao: "",
  dataDefeito: "",
  descricaoDefeito: "",
}

function Section({
  step,
  icon: Icon,
  title,
  hint,
  children,
}: {
  step: string
  icon: LucideIcon
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">
          {step}
        </span>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
  full,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  type?: string
  full?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  )
}

export function NovaGarantiaForm({ vendedorNome }: { vendedorNome: string }) {
  const router = useRouter()
  const [form, setForm] = useState<NovaGarantiaInput>(EMPTY)
  const [pending, startTransition] = useTransition()

  const set = (key: keyof NovaGarantiaInput) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clienteNome.trim() || !form.produtoDescricao.trim() || !form.descricaoDefeito.trim()) {
      toast.error("Preencha cliente, produto e a descrição do defeito.")
      return
    }
    startTransition(async () => {
      const res = await abrirGarantia(form)
      if (res.ok) {
        toast.success(`Garantia aberta — protocolo ${res.protocolo}`)
        router.push("/garantias")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Section step="01" icon={User} title="Dados do cliente" hint="Quem comprou a peça">
        <Field label="Nome / Razão Social" value={form.clienteNome!} onChange={set("clienteNome")} required full />
        <Field label="Contato" value={form.clienteContato!} onChange={set("clienteContato")} />
        <Field label="Fone / Celular" value={form.clienteFone!} onChange={set("clienteFone")} />
        <Field label="E-mail" type="email" value={form.clienteEmail!} onChange={set("clienteEmail")} />
        <Field label="Nº da Nota Fiscal de Compra" value={form.notaNumero!} onChange={set("notaNumero")} />
        <Field label="Data da Compra" value={form.dataCompra!} onChange={set("dataCompra")} placeholder="dd/mm/aaaa" />
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Loja</Label>
          <Select value={form.loja || undefined} onValueChange={set("loja")}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sama">Sama</SelectItem>
              <SelectItem value="Laguna">Laguna</SelectItem>
              <SelectItem value="Matrix">Matrix</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Vendedor</Label>
          <Input value={vendedorNome} disabled aria-label="Vendedor" />
        </div>
      </Section>

      <Section step="02" icon={Package} title="Dados do produto" hint="Alguns campos são só para peças de motores">
        <Field label="Nº da Peça" value={form.pecaNumero!} onChange={set("pecaNumero")} />
        <Field label="Descrição da Peça" value={form.produtoDescricao!} onChange={set("produtoDescricao")} required />
        <Field label="Marca da Peça" value={form.pecaMarca!} onChange={set("pecaMarca")} />
        <Field label="Veículo" value={form.veiculo!} onChange={set("veiculo")} />
        <Field label="Ano / Modelo" value={form.anoModelo!} onChange={set("anoModelo")} />
        <Field label="Motor" value={form.motor!} onChange={set("motor")} />
      </Section>

      <Section step="03" icon={Gauge} title="Informações de uso">
        <Field label="Km Inicial" value={form.kmInicial!} onChange={set("kmInicial")} />
        <Field label="Km na Data do Defeito" value={form.kmDefeito!} onChange={set("kmDefeito")} />
        <Field label="Km Rodado" value={form.kmRodado!} onChange={set("kmRodado")} />
        <Field label="Horas Rodadas (estacionários)" value={form.horasRodadas!} onChange={set("horasRodadas")} />
        <Field label="Data da Aplicação" value={form.dataAplicacao!} onChange={set("dataAplicacao")} placeholder="dd/mm/aaaa" />
        <Field label="Data do Defeito Apresentado" value={form.dataDefeito!} onChange={set("dataDefeito")} placeholder="dd/mm/aaaa" />
      </Section>

      <Section step="04" icon={FileWarning} title="Descrição do defeito e suas consequências">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label className="text-xs">
            Descrição do defeito<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Textarea
            value={form.descricaoDefeito}
            onChange={(e) => set("descricaoDefeito")(e.target.value)}
            rows={5}
            placeholder="Descreva o defeito apresentado e as consequências..."
            required
          />
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/garantias")} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Abrir garantia
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
