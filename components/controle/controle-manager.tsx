"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, LayoutGrid } from "lucide-react"
import { ModuloCard } from "./modulo-card"
import { ModuloDialog } from "./modulo-dialog"
import { createModulo, updateModulo, deleteModulo, type ModuloControle, type ModuloInput } from "@/app/actions/controle"

export function ControleManager({
  modulosIniciais,
  canWrite,
}: {
  modulosIniciais: ModuloControle[]
  canWrite: boolean
}) {
  const [modulos, setModulos] = useState<ModuloControle[]>(modulosIniciais)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ModuloControle | null>(null)
  const [toDelete, setToDelete] = useState<ModuloControle | null>(null)
  const [pending, startTransition] = useTransition()

  function openNovo() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(m: ModuloControle) {
    setEditing(m)
    setDialogOpen(true)
  }

  function handleSave(input: ModuloInput) {
    startTransition(async () => {
      const res = editing ? await updateModulo(editing.id, input) : await createModulo(input)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const now = new Date()
      if (editing) {
        setModulos((prev) =>
          prev.map((m) => (m.id === editing.id ? { ...m, ...input, updatedAt: now } : m)),
        )
        toast.success("Módulo atualizado.")
      } else {
        const id = res.data?.id ?? Math.random()
        setModulos((prev) => [
          ...prev,
          {
            id,
            titulo: input.titulo,
            colunas: input.colunas,
            linhas: input.linhas,
            ordem: prev.length + 1,
            createdBy: null,
            createdByNome: null,
            createdAt: now,
            updatedAt: now,
          } as ModuloControle,
        ])
        toast.success("Módulo criado.")
      }
      setDialogOpen(false)
      setEditing(null)
    })
  }

  function handleDelete() {
    if (!toDelete) return
    const id = toDelete.id
    startTransition(async () => {
      const res = await deleteModulo(id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setModulos((prev) => prev.filter((m) => m.id !== id))
      toast.success("Módulo removido.")
      setToDelete(null)
    })
  }

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={openNovo} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo módulo
          </Button>
        </div>
      )}

      {modulos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Nenhum módulo ainda</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Crie módulos com título, colunas e linhas. Cada módulo vira um gráfico para acompanhar os números do
              seu jeito.
            </p>
          </div>
          {canWrite && (
            <Button onClick={openNovo} className="mt-1 gap-1.5">
              <Plus className="h-4 w-4" />
              Criar primeiro módulo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {modulos.map((m) => (
            <ModuloCard
              key={m.id}
              modulo={m}
              canWrite={canWrite}
              onEdit={() => openEdit(m)}
              onDelete={() => setToDelete(m)}
            />
          ))}
        </div>
      )}

      <ModuloDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        modulo={editing}
        saving={pending}
        onSave={handleSave}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover módulo</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `O módulo "${toDelete.titulo}" será removido permanentemente.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
