"use client"

import { ArrowRight, CalendarDays, Hash, ListChecks, MoreVertical, Pencil, Table2, TextCursorInput, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ModuloControle, TipoColuna } from "@/app/actions/controle"

const ICONS: Record<TipoColuna, typeof TextCursorInput> = { texto: TextCursorInput, numero: Hash, data: CalendarDays, status: ListChecks }

export function ModuloCard({ modulo, canWrite, onOpen, onEdit, onDelete }: {
  modulo: ModuloControle
  canWrite: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen() } }}
      className="group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Table2 className="size-5" /></span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Tabela livre</Badge>
            {canWrite && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                  <Button variant="ghost" size="icon" aria-label={`Opções de ${modulo.titulo}`} className="size-8">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={onEdit}><Pencil />Editar título e colunas</DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 />Excluir tabela</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <CardTitle className="mt-3 text-lg text-balance">{modulo.titulo}</CardTitle>
        {modulo.descricao
          ? <p className="line-clamp-2 text-sm text-muted-foreground">{modulo.descricao}</p>
          : <p className="text-sm text-muted-foreground">Atualizada em {new Date(modulo.updatedAt).toLocaleDateString("pt-BR")}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex items-center gap-5">
          <div><strong className="text-2xl tabular-nums">{modulo.linhas.length}</strong><p className="text-xs text-muted-foreground">linhas</p></div>
          <div><strong className="text-2xl tabular-nums">{modulo.colunas.length}</strong><p className="text-xs text-muted-foreground">colunas</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {modulo.colunas.slice(0, 4).map((column) => { const Icon = ICONS[column.tipo]; return <Badge key={column.id} variant="outline" className="gap-1"><Icon className="size-3" />{column.nome}</Badge> })}
          {modulo.colunas.length > 4 && <Badge variant="outline">+{modulo.colunas.length - 4}</Badge>}
        </div>
      </CardContent>
      <CardFooter className="justify-between border-t bg-muted/10 py-3 text-sm font-medium text-primary">
        <span>Abrir planilha</span>
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </CardFooter>
    </Card>
  )
}
