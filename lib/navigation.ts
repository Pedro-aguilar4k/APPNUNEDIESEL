import type { Permission } from "@/lib/permissions"
import {
  LayoutDashboard,
  FileInput,
  ScanBarcode,
  Package,
  Building2,
  Link2,
  Sparkles,
  BarChart3,
  Users,
  Boxes,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

export type NavCategory = "overview" | "operation" | "intelligence" | "registry" | "admin" | "stock"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  permission: Permission
  group: "operacao" | "estoque" | "cadastros" | "gestao"
  category: NavCategory
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "view", group: "operacao", category: "overview" },
  { href: "/importar", label: "Importar NF-e", icon: FileInput, permission: "gerenciar_notas", group: "operacao", category: "operation" },
  { href: "/reconhecimento", label: "Reconhecimento", icon: Sparkles, permission: "gerenciar_notas", group: "operacao", category: "intelligence" },
  { href: "/estoque/controle", label: "Controle", icon: Boxes, permission: "conferir", group: "estoque", category: "stock" },
  { href: "/estoque/garantia", label: "Garantia", icon: ShieldCheck, permission: "conferir", group: "estoque", category: "stock" },
  { href: "/estoque/conferencia", label: "Conferência", icon: ScanBarcode, permission: "conferir", group: "estoque", category: "operation" },
  { href: "/produtos", label: "Produtos", icon: Package, permission: "gerenciar_cadastros", group: "cadastros", category: "registry" },
  { href: "/fornecedores", label: "Fornecedores", icon: Building2, permission: "gerenciar_cadastros", group: "cadastros", category: "registry" },
  { href: "/equivalencias", label: "Equivalências", icon: Link2, permission: "gerenciar_cadastros", group: "cadastros", category: "registry" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "relatorios", group: "gestao", category: "intelligence" },
  { href: "/usuarios", label: "Usuários", icon: Users, permission: "gerenciar_usuarios", group: "gestao", category: "admin" },
]

export const GROUP_LABELS: Record<NavItem["group"], string> = {
  operacao: "Operação",
  estoque: "Estoque",
  cadastros: "Cadastros",
  gestao: "Gestão",
}
