"use client"

import { useState } from "react"
import useSWR from "swr"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { listProdutos } from "@/app/actions/produtos"

export function ProdutoCombobox({
  onSelect,
  triggerLabel = "Vincular produto",
}: {
  onSelect: (produtoId: number, descricao: string) => void
  triggerLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const { data, isLoading } = useSWR(open ? ["combo-produtos", q] : null, () =>
    listProdutos({ q, page: 1, pageSize: 30 }),
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Search className="h-3.5 w-3.5" />
          {triggerLabel}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar produto..." value={q} onValueChange={setQ} />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>
            ) : !data || data.rows.length === 0 ? (
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {data.rows.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={String(p.id)}
                    onSelect={() => {
                      onSelect(p.id, p.descricao)
                      setOpen(false)
                    }}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="flex w-full items-center gap-2">
                      <Check className="h-3.5 w-3.5 opacity-0" />
                      <span className="font-mono text-xs text-muted-foreground">{p.codigoInterno}</span>
                    </span>
                    <span className="line-clamp-1 pl-5 text-sm">{p.descricao}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
