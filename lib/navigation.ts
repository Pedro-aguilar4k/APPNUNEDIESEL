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
  ShieldPlus,
  PackageSearch,
  ScrollText,
  type LucideIcon,
} from "lucide-react"

export type NavCategory = "overview" | "operation" | "intelligence" | "registry" | "admin" | "stock" | "warranty"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  permission: Permission
  group: "operacao" | "estoque" | "garantias" | "cadastros" | "gestao"
  category: NavCategory
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "view", group: "operacao", category: "overview" },
  { href: "/importar", label: "Importar NF-e", icon: FileInput, permission: "gerenciar_notas", group: "operacao", category: "operation" },
  { href: "/reconhecimento", label: "Reconhecimento", icon: Sparkles, permission: "gerenciar_notas", group: "operacao", category: "intelligence" },
  { href: "/estoque/controle", label: "Controle", icon: Boxes, permission: "conferir", group: "estoque", category: "stock" },
  { href: "/estoque/espera", label: "Espera", icon: PackageSearch, permission: "conferir", group: "estoque", category: "stock" },
  { href: "/estoque/garantia", label: "Garantia", icon: ShieldCheck, permission: "gerenciar_garantia", group: "estoque", category: "stock" },
  { href: "/estoque/conferencia", label: "Conferência", icon: ScanBarcode, permission: "conferir", group: "estoque", category: "operation" },
  // Vendedor (acesso mínimo): só abre e acompanha as próprias garantias.
  { href: "/garantias", label: "Minhas garantias", icon: ShieldCheck, permission: "abrir_garantia", group: "garantias", category: "warranty" },
  { href: "/garantias/nova", label: "Abrir garantia", icon: ShieldPlus, permission: "abrir_garantia", group: "garantias", category: "warranty" },
  { href: "/produtos", label: "Produtos", icon: Package, permission: "gerenciar_cadastros", group: "cadastros", category: "registry" },
  { href: "/fornecedores", label: "Fornecedores", icon: Building2, permission: "gerenciar_cadastros", group: "cadastros", category: "registry" },
  { href: "/equivalencias", label: "Equivalências", icon: Link2, permission: "gerenciar_cadastros", group: "cadastros", category: "registry" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "relatorios", group: "gestao", category: "intelligence" },
  { href: "/logs", label: "Logs", icon: ScrollText, permission: "ver_logs", group: "gestao", category: "admin" },
  { href: "/usuarios", label: "Usuários", icon: Users, permission: "gerenciar_usuarios", group: "gestao", category: "admin" },
]

export const GROUP_LABELS: Record<NavItem["group"], string> = {
  operacao: "Operação",
  estoque: "Estoque",
  garantias: "Garantias",
  cadastros: "Cadastros",
  gestao: "Gestão",
}
