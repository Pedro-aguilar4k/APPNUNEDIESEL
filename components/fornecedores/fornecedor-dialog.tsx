"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Fornecedor, FornecedorInput } from "@/app/actions/fornecedores"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fornecedor: Fornecedor | null
  onSubmit: (input: FornecedorInput) => Promise<boolean>
}

const EMPTY: FornecedorInput = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  email: "",
  telefone: "",
  ativo: true,
}

export function FornecedorDialog({ open, onOpenChange, fornecedor, onSubmit }: Props) {
  const [form, setForm] = useState<FornecedorInput>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        fornecedor
          ? {
              razaoSocial: fornecedor.razaoSocial,
              nomeFantasia: fornecedor.nomeFantasia ?? "",
              cnpj: fornecedor.cnpj ?? "",
              email: fornecedor.email ?? "",
              telefone: fornecedor.telefone ?? "",
              ativo: fornecedor.ativo,
            }
          : EMPTY,
      )
    }
  }, [open, fornecedor])

  function set<K extends keyof FornecedorInput>(key: K, value: FornecedorInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSubmit(form)
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fornecedor ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="razaoSocial">Razão social</Label>
            <Input
              id="razaoSocial"
              value={form.razaoSocial}
              onChange={(e) => set("razaoSocial", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nomeFantasia">Nome fantasia</Label>
            <Input
              id="nomeFantasia"
              value={form.nomeFantasia}
              onChange={(e) => set("nomeFantasia", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input id="cnpj" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
