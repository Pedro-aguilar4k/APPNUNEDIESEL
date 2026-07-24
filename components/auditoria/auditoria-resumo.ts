import type { Contagem, LinhaOficial, ItemRelatorio, ResumoRelatorio, StatusItem } from "@/app/actions/auditoria"

// Reconstrói o resumo consolidado no cliente (dashboard e prévia do relatório),
// espelhando exatamente a lógica do servidor em app/actions/auditoria.ts.
// Consolida por código (soma, sem duplicar) mantendo todas as localizações.
export function construirResumoCliente(oficial: LinhaOficial[], contagens: Contagem[]): ResumoRelatorio {
  const up = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ")
  const toNumber = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

  const oficialPorCodigo = new Map<string, LinhaOficial>()
  for (const linha of oficial) oficialPorCodigo.set(up(linha.codigo), linha)

  const contadosPorCodigo = new Map<string, { total: number; locais: Map<string, number>; observacoes: string[] }>()
  for (const c of contagens) {
    const codigo = up(c.codigo)
    const grupo = contadosPorCodigo.get(codigo) ?? { total: 0, locais: new Map<string, number>(), observacoes: [] as string[] }
    grupo.total += toNumber(c.quantidade)
    grupo.locais.set(c.localizacaoFull, (grupo.locais.get(c.localizacaoFull) ?? 0) + toNumber(c.quantidade))
    if (c.observacao?.trim()) grupo.observacoes.push(c.observacao.trim())
    contadosPorCodigo.set(codigo, grupo)
  }

  const itens: ItemRelatorio[] = []
  const codigos = new Set<string>([...oficialPorCodigo.keys(), ...contadosPorCodigo.keys()])

  for (const codigo of codigos) {
    const ref = oficialPorCodigo.get(codigo) ?? null
    const contado = contadosPorCodigo.get(codigo)
    const quantidadeSistema = ref ? toNumber(ref.quantidadeSistema) : 0
    const quantidadeContada = contado ? contado.total : 0
    const localizacoes = contado ? [...contado.locais.entries()].map(([local, quantidade]) => ({ local, quantidade })) : []
    const multiplasLocalizacoes = localizacoes.length > 1

    let status: StatusItem
    if (!ref) status = "sem_cadastro"
    else if (!contado) status = "nao_encontrado"
    else if (quantidadeContada === quantidadeSistema) status = "correto"
    else if (quantidadeContada > quantidadeSistema) status = "sobra"
    else status = "falta"

    itens.push({
      codigo,
      descricao: ref?.descricao ?? null,
      quantidadeSistema,
      quantidadeContada,
      diferenca: quantidadeContada - quantidadeSistema,
      status,
      localizacoes,
      multiplasLocalizacoes,
      observacoes: contado?.observacoes ?? [],
    })
  }

  itens.sort((a, b) => a.codigo.localeCompare(b.codigo))

  const corretos = itens.filter((i) => i.status === "correto").length
  const sobras = itens.filter((i) => i.status === "sobra").length
  const faltas = itens.filter((i) => i.status === "falta").length
  const naoEncontrados = itens.filter((i) => i.status === "nao_encontrado").length
  const semCadastro = itens.filter((i) => i.status === "sem_cadastro").length
  const multiplasLocalizacoes = itens.filter((i) => i.multiplasLocalizacoes).length
  const totalImportados = oficialPorCodigo.size
  const totalConferidos = contadosPorCodigo.size
  const percentualConcluido = totalImportados === 0 ? 0 : Math.round(((corretos + sobras + faltas) / totalImportados) * 100)

  return {
    totalImportados,
    totalConferidos,
    totalDivergencias: sobras + faltas + naoEncontrados + semCadastro,
    corretos,
    sobras,
    faltas,
    naoEncontrados,
    semCadastro,
    multiplasLocalizacoes,
    percentualConcluido,
    itens,
  }
}

export const STATUS_LABEL: Record<StatusItem, string> = {
  correto: "Correto",
  sobra: "Sobra",
  falta: "Falta",
  sem_cadastro: "Sem cadastro no oficial",
  nao_encontrado: "Não encontrado na contagem",
}
