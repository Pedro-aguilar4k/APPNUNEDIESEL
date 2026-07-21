"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  createUser,
  updateUserRole,
  setUserBanned,
  resetUserPassword,
  deleteUser,
  type UserRow,
} from "@/app/actions/users"
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleBadge } from "@/components/role-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, UserPlus, Loader2 } from "lucide-react"

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)

  // formulário de criação
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "estoquista" as Role })

  // reset de senha
  const [resetFor, setResetFor] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState("")

  function handleCreate() {
    startTransition(async () => {
      const res = await createUser(form)
      if (res.ok) {
        toast.success("Usuário criado.")
        setCreateOpen(false)
        setForm({ name: "", username: "", password: "", role: "estoquista" })
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleRole(userId: string, role: Role) {
    startTransition(async () => {
      const res = await updateUserRole(userId, role)
      res.ok ? toast.success("Papel atualizado.") : toast.error(res.error)
    })
  }

  function handleBan(u: UserRow) {
    startTransition(async () => {
      const res = await setUserBanned(u.id, !u.banned)
      res.ok ? toast.success(u.banned ? "Acesso liberado." : "Acesso bloqueado.") : toast.error(res.error)
    })
  }

  function handleDelete(u: UserRow) {
    if (!confirm(`Remover o usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const res = await deleteUser(u.id)
      res.ok ? toast.success("Usuário removido.") : toast.error(res.error)
    })
  }

  function handleReset() {
    if (!resetFor) return
    startTransition(async () => {
      const res = await resetUserPassword(resetFor.id, newPassword)
      if (res.ok) {
        toast.success("Senha redefinida.")
        setResetFor(null)
        setNewPassword("")
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo usuário</DialogTitle>
              <DialogDescription>Crie uma conta de acesso para um operador.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-name">Nome completo</Label>
                <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-username">Usuário</Label>
                <Input
                  id="c-username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="nome.sobrenome"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-password">Senha provisória</Label>
                <Input
                  id="c-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="mínimo 8 caracteres"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-role">Papel</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger id="c-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Criar usuário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(você)</span> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.username}</TableCell>
                  <TableCell>
                    {isSelf ? (
                      <RoleBadge role={u.role} />
                    ) : (
                      <Select value={u.role} onValueChange={(v) => handleRole(u.id, v as Role)} disabled={pending}>
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.banned ? (
                      <span className="text-sm text-destructive">Bloqueado</span>
                    ) : (
                      <span className="text-sm text-chart-2">Ativo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isSelf || pending}>
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setResetFor(u)}>Redefinir senha</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBan(u)}>
                          {u.banned ? "Liberar acesso" : "Bloquear acesso"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(u)}>
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={resetFor !== null} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {resetFor?.name}. O usuário deverá usá-la no próximo acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="reset-pw">Nova senha</Label>
            <Input
              id="reset-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleReset} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Salvar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
