"use client"

import { useEffect, useState, useTransition } from "react"
import type { Produto, ProdutoInput } from "@/app/actions/produtos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

const EMPTY: ProdutoInput = {
  codigoInterno: "",
  descricao: "",
  codigoBarras: "",
  fabricante: "",
  codigoFabricante: "",
  ncm: "",
  unidade: "UN",
  precoCusto: "",
  precoVenda: "",
  estoqueAtual: 0,
  localizacao: "",
  ativo: true,
}

export function ProdutoDialog({
  open,
  onOpenChange,
  produto,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  produto: Produto | null
  onSubmit: (input: ProdutoInput) => Promise<boolean>
}) {
  const [form, setForm] = useState<ProdutoInput>(EMPTY)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setForm(
        produto
          ? {
              codigoInterno: produto.codigoInterno,
              descricao: produto.descricao,
              codigoBarras: produto.codigoBarras ?? "",
              fabricante: produto.fabricante ?? "",
              codigoFabricante: produto.codigoFabricante ?? "",
              ncm: produto.ncm ?? "",
              unidade: produto.unidade ?? "UN",
              precoCusto: produto.precoCusto ?? "",
              precoVenda: produto.precoVenda ?? "",
              estoqueAtual: produto.estoqueAtual ?? 0,
              localizacao: produto.localizacao ?? "",
              ativo: produto.ativo,
            }
          : EMPTY,
      )
    }
  }, [open, produto])

  function set<K extends keyof ProdutoInput>(key: K, value: ProdutoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSave() {
    startTransition(async () => {
      await onSubmit(form)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>Dados do produto interno usados na conferência.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-1">
            <Label htmlFor="p-codigo">Código interno *</Label>
            <Input id="p-codigo" value={form.codigoInterno} onChange={(e) => set("codigoInterno", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-1">
            <Label htmlFor="p-ean">Código de barras (EAN)</Label>
            <Input id="p-ean" value={form.codigoBarras} onChange={(e) => set("codigoBarras", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="p-desc">Descrição *</Label>
            <Input id="p-desc" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-fab">Fabricante</Label>
            <Input id="p-fab" value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-codfab">Código do fabricante</Label>
            <Input id="p-codfab" value={form.codigoFabricante} onChange={(e) => set("codigoFabricante", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-ncm">NCM</Label>
            <Input id="p-ncm" value={form.ncm} onChange={(e) => set("ncm", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-un">Unidade</Label>
            <Input id="p-un" value={form.unidade} onChange={(e) => set("unidade", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-custo">Preço de custo</Label>
            <Input
              id="p-custo"
              inputMode="decimal"
              value={form.precoCusto}
              onChange={(e) => set("precoCusto", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-venda">Preço de venda</Label>
            <Input
              id="p-venda"
              inputMode="decimal"
              value={form.precoVenda}
              onChange={(e) => set("precoVenda", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-estoque">Estoque atual</Label>
            <Input
              id="p-estoque"
              type="number"
              value={form.estoqueAtual}
              onChange={(e) => set("estoqueAtual", Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-loc">Localização</Label>
            <Input id="p-loc" value={form.localizacao} onChange={(e) => set("localizacao", e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 sm:col-span-2">
            <Label htmlFor="p-ativo">Produto ativo</Label>
            <Switch id="p-ativo" checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {produto ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
