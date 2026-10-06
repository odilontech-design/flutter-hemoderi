/**
 * Leitura e tratamento da base do CRM (PipeDrive, ata de 05/10): dois CSV —
 * organizações e pessoas — viram um PLANO de pré-cadastros: quais clínicas
 * criar, quais pessoas ligar a elas e o que a equipe precisa conferir.
 *
 * Sem banco e sem rede, de propósito: o que esta função faz é transformar a
 * exportação bagunçada (nome de clínica duplicado, telefone com apóstrofo e
 * dois números na mesma célula, endereço de um jeito só às vezes) em linhas
 * conferidas, e é isso que os testes cobrem. Gravar é com `executarPlanoCrm`.
 *
 * As regras são as mesmas da planilha de conferência entregue à equipe (aba
 * "Regras"): se uma mudar aqui, a planilha deixa de bater com o que entra.
 */

// ─── CSV ────────────────────────────────────────────────────────────────────

/**
 * O separador do CSV, pela primeira linha (fora de aspas): vírgula é o que o
 * PipeDrive exporta, mas o Excel em português grava ponto e vírgula quando o
 * arquivo é aberto e salvo de novo, e quem cola de planilha traz tabulação.
 */
function detectarSeparador(texto: string): string {
  const contagem: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let dentroDeAspas = false;
  for (const c of texto) {
    if (c === '"') dentroDeAspas = !dentroDeAspas;
    else if (!dentroDeAspas) {
      if (c === "\n" || c === "\r") break;
      if (c in contagem) contagem[c]++;
    }
  }
  return Object.entries(contagem).sort((x, y) => y[1] - x[1])[0][1] > 0
    ? Object.entries(contagem).sort((x, y) => y[1] - x[1])[0][0]
    : ",";
}

/**
 * Bytes do arquivo para texto. UTF-8 é o normal; o Excel antigo grava em
 * Windows-1252 (acento vira lixo se lido como UTF-8) e alguns "Unicode" são
 * UTF-16. Tenta nessa ordem, em vez de pedir ao usuário que saiba a diferença.
 */
export function decodificarCsv(bytes: ArrayBuffer): string {
  const u = new Uint8Array(bytes);
  if (u.length >= 2 && u[0] === 0xff && u[1] === 0xfe) return new TextDecoder("utf-16le").decode(u);
  if (u.length >= 2 && u[0] === 0xfe && u[1] === 0xff) return new TextDecoder("utf-16be").decode(u);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(u);
  } catch {
    return new TextDecoder("windows-1252").decode(u);
  }
}

/**
 * CSV com aspas: campo pode ter o separador, aspas duplas ("") e quebra de
 * linha dentro. Aceita BOM, CRLF e os separadores vírgula, ponto e vírgula e
 * tabulação (detectado). Devolve linhas de células cruas.
 */
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let celula = "";
  let linha: string[] = [];
  let dentroDeAspas = false;
  const t = texto.replace(/^\uFEFF/, "");
  const separador = detectarSeparador(t);

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          celula += '"';
          i++;
        } else dentroDeAspas = false;
      } else celula += c;
      continue;
    }
    if (c === '"') dentroDeAspas = true;
    else if (c === separador) {
      linha.push(celula);
      celula = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(celula);
      celula = "";
      if (linha.some((x) => x !== "")) linhas.push(linha);
      linha = [];
    } else celula += c;
  }
  linha.push(celula);
  if (linha.some((x) => x !== "")) linhas.push(linha);
  return linhas;
}

/** Linhas do CSV como objetos, pelo nome (sem acento/caixa) do cabeçalho. */
function comoRegistros(texto: string): { registros: Record<string, string>[]; cabecalhos: string[]; originais: string[] } {
  const linhas = lerCsv(texto);
  if (linhas.length === 0) return { registros: [], cabecalhos: [], originais: [] };
  const originais = linhas[0].map((h) => h.trim());
  const cabecalhos = linhas[0].map((h) => chave(h));
  const registros = linhas.slice(1).map((l) => {
    const r: Record<string, string> = {};
    cabecalhos.forEach((h, i) => (r[h] = (l[i] ?? "").trim()));
    return r;
  });
  return { registros, cabecalhos, originais };
}

// ─── Normalização ───────────────────────────────────────────────────────────

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Chave de comparação: sem acento, caixa, pontuação nem espaço repetido. */
export function chave(t: string): string {
  return semAcento(t)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TITULO = /^\s*(dr|dra|de|prof|profa)\b[\s.]*/i;

/** "Dra. Ana Lima" → "Ana Lima". "De." é erro de digitação de "Dr." na base. */
export function semTitulo(nome: string): string {
  const limpo = nome.trim();
  const sem = limpo.replace(TITULO, "").trim();
  return sem || limpo;
}

export function tituloDe(nome: string): string | null {
  const m = nome.match(/^\s*(dra|dr|prof|profa)\b/i);
  if (!m) return null;
  return { dr: "Dr.", dra: "Dra.", prof: "Prof.", profa: "Profa." }[m[1].toLowerCase()] ?? null;
}

function limparNome(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

// ─── Telefone ───────────────────────────────────────────────────────────────

export type TelefoneTratado = { numero: string; tipo: "Celular" | "Fixo"; dddAssumido: boolean };

/**
 * Os números de uma célula do CRM. A célula traz de tudo: apóstrofo na frente
 * (resto do Excel), "+55", zero do DDD, vários números separados por vírgula,
 * número sem DDD. Sai em dígitos nacionais (DDD + número), com o tipo.
 * Número sem DDD recebe 11 (a base é da Grande SP) e vai marcado.
 */
export function lerTelefones(bruto: string): { telefones: TelefoneTratado[]; invalidos: string[] } {
  const telefones: TelefoneTratado[] = [];
  const invalidos: string[] = [];
  if (!bruto.trim()) return { telefones, invalidos };

  for (const item of bruto.replace(/'/g, "").split(/[,;/]|\s{2,}| e /)) {
    if (!item.trim()) continue;
    let d = item.replace(/\D/g, "");
    let dddAssumido = false;
    if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
    if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1);
    if (d.length === 8 || d.length === 9) {
      d = "11" + d;
      dddAssumido = true;
    }
    if (d.length !== 10 && d.length !== 11) {
      invalidos.push(item.trim());
      continue;
    }
    const tipo = d.length === 11 && d[2] === "9" ? "Celular" : "Fixo";
    if (!telefones.some((t) => t.numero === d)) telefones.push({ numero: d, tipo, dddAssumido });
  }
  return { telefones, invalidos };
}

/** "11999990000" → "(11) 99999-0000" — o mesmo formato dos cadastros feitos à mão. */
export function formatarNumero(d: string): string {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

// ─── Endereço ───────────────────────────────────────────────────────────────

export type EnderecoTratado = {
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
};

/**
 * Endereço no padrão do Google ("Rua X, 211 - Bairro, Cidade - SP, 01234-567,
 * Brasil") quebrado em colunas. O que não segue o padrão fica só no
 * logradouro: melhor um endereço incompleto que um endereço inventado.
 */
export function lerEndereco(bruto: string): EnderecoTratado {
  const vazio: EnderecoTratado = {
    endereco: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    uf: null,
    cep: null,
  };
  const e = bruto.trim();
  if (!e) return vazio;

  let cep: string | null = null;
  const achouCep = e.match(/\b(\d{5})-?(\d{3})\b/);
  if (achouCep) cep = `${achouCep[1]}-${achouCep[2]}`;

  const texto = e
    .replace(/,?\s*Brasil\s*$/i, "")
    .replace(/,?\s*\d{5}-?\d{3}\s*$/, "")
    .trim();
  const partes = texto.split(" - ").map((x) => x.trim());
  let logradouro = partes[0];
  let resto = partes.slice(1);
  let bairro: string | null = null;
  let cidade: string | null = null;
  let uf: string | null = null;

  if (resto.length > 0 && /^[A-Z]{2}$/.test(resto[resto.length - 1])) {
    uf = resto[resto.length - 1];
    resto = resto.slice(0, -1);
    const meio = resto.join(" - ");
    const virgula = meio.lastIndexOf(",");
    if (virgula >= 0) {
      bairro = meio.slice(0, virgula).trim() || null;
      cidade = meio.slice(virgula + 1).trim() || null;
    } else cidade = meio.trim() || null;
  } else if (resto.length > 0) {
    const meio = resto.join(" - ").replace(/^[ ,]+|[ ,]+$/g, "");
    if (/^(cj|conj|apto?|sala|andar|loja|bloco|sl|\d)/i.test(meio)) logradouro = `${logradouro} - ${meio}`;
    else bairro = meio || null;
  }

  // "Rua X, 211 cj 4" → rua, número e complemento; sem vírgula+número fica tudo
  // no logradouro.
  let numero: string | null = null;
  let complemento: string | null = null;
  const m = logradouro.match(/^(.+?),\s*(\d+[A-Za-z]?)\b\s*[-,]?\s*(.*)$/);
  if (m) {
    logradouro = m[1].trim();
    numero = m[2];
    complemento = m[3].trim() || null;
  }

  return { endereco: logradouro || null, numero, complemento, bairro, cidade, uf, cep };
}

// ─── Plano ──────────────────────────────────────────────────────────────────

export type ClinicaCrm = {
  /** idCrm: "org:<nome normalizado>" ou "pes:<nome normalizado>" (profissional avulso). */
  chave: string;
  nome: string;
  tipo: string;
  telefone: string | null;
  endereco: EnderecoTratado;
  negociosFechados: number;
  negociosAbertos: number;
  /** Quantos cadastros do PipeDrive viraram esta clínica. */
  cadastrosOrigem: number;
  avisos: string[];
};

export type PessoaCrm = {
  /** idCrm: "pes:<nome sem título>|<chave da clínica>". */
  chave: string;
  nome: string;
  titulo: string | null;
  telefone: string | null;
  tipoTelefone: string | null;
  telefone2: string | null;
  email: string | null;
  origem: string | null;
  negociosFechados: number;
  negociosAbertos: number;
  clinicaChave: string;
  observacoes: string | null;
};

export type ResumoCrm = {
  organizacoesNoArquivo: number;
  pessoasNoArquivo: number;
  clinicas: number;
  clinicasComNegocioFechado: number;
  duplicadasConsolidadas: number;
  pessoas: number;
  pessoasDuplicadasMescladas: number;
  clinicasDeProfissionalAvulso: number;
  clinicasSemProfissional: number;
  pessoasComTelefone: number;
  pessoasComCelular: number;
  pessoasComEmail: number;
  porTipo: Record<string, number>;
};

export type PlanoCrm = { clinicas: ClinicaCrm[]; pessoas: PessoaCrm[]; resumo: ResumoCrm };

const PALAVRAS_DE_CLINICA =
  /cl[ií]nica|odonto|centro|instituto|studio|est[úu]dio|consult[óo]rio|sorriso|implant|ortodont|sa[úu]de|center|hospital|laborat|polic|dental|face|est[eé]tic|oral|ltda|\bme\b|\bepp\b|abo|apcd|facop|unic|premium|vital/i;

function tipoDaClinica(nome: string, pessoas: number): string {
  if (pessoas >= 2) return "Clínica (2+ profissionais)";
  const dr = /^\s*(dr|dra)\b/i.test(nome);
  if (pessoas === 0) {
    if (dr) return "Consultório individual";
    return PALAVRAS_DE_CLINICA.test(nome) ? "Clínica (sem profissional no CRM)" : "A definir";
  }
  if (dr) return "Consultório individual";
  return PALAVRAS_DE_CLINICA.test(nome) ? "Clínica (1 profissional)" : "A definir";
}

function numero(t: string | undefined): number {
  const n = parseInt((t ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export class ArquivoCrmInvalido extends Error {}

/** O plano de pré-cadastros a partir dos dois CSV. Lança ArquivoCrmInvalido se faltar coluna. */
export function montarPlanoCrm(csvOrganizacoes: string, csvPessoas: string): PlanoCrm {
  const o = comoRegistros(csvOrganizacoes);
  const p = comoRegistros(csvPessoas);

  const exigir = (leitura: { cabecalhos: string[]; originais: string[] }, coluna: string, arquivo: string) => {
    if (!leitura.cabecalhos.includes(chave(coluna))) {
      const achadas = leitura.originais.slice(0, 4).join(" | ");
      throw new ArquivoCrmInvalido(
        `${arquivo}: falta a coluna "${coluna}". É a exportação de ${arquivo.toLowerCase()} do PipeDrive?` +
          (achadas ? ` Colunas encontradas: ${achadas}…` : " O arquivo está vazio.")
      );
    }
  };
  exigir(o, "Organização - Nome", "Organizações");
  exigir(p, "Pessoa - Nome", "Pessoas");
  exigir(p, "Pessoa - Organização", "Pessoas");

  // Organizações: mesmo nome normalizado = uma clínica só (negócios somados).
  type OrgBruta = { nome: string; endereco: string; fechados: number; abertos: number; cadastros: number };
  const orgs = new Map<string, OrgBruta>();
  for (const r of o.registros) {
    const nome = limparNome(r[chave("Organização - Nome")] ?? "");
    if (!nome) continue;
    const k = chave(nome);
    if (!k) continue;
    const atual = orgs.get(k);
    const fechados = numero(r[chave("Organização - Negócios fechados")]);
    const abertos = numero(r[chave("Organização - Negócios em aberto")]);
    const endereco = r[chave("Organização - Endereço")] ?? "";
    if (atual) {
      atual.fechados += fechados;
      atual.abertos += abertos;
      atual.cadastros += 1;
      if (!atual.endereco && endereco) atual.endereco = endereco;
    } else orgs.set(k, { nome, endereco, fechados, abertos, cadastros: 1 });
  }

  // Nome da organização sem o título, para casar pessoa sem organização com
  // o consultório que leva o nome dela ("Dr Fulano de Tal"). Só vale se um
  // nome corresponde a UMA organização — com duas, não dá para escolher.
  const orgPorNomeSemTitulo = new Map<string, string | null>();
  for (const [k, org] of orgs) {
    const sem = chave(semTitulo(org.nome));
    orgPorNomeSemTitulo.set(sem, orgPorNomeSemTitulo.has(sem) ? null : k);
  }

  // Pessoas: mesma pessoa na mesma organização = um registro (soma negócios).
  type PessoaBruta = PessoaCrm & { telefones: TelefoneTratado[]; avisos: string[]; clinicaNome: string; clinicaNova: boolean };
  const pessoas = new Map<string, PessoaBruta>();
  const clinicasAvulsas = new Map<string, { nome: string; tipo: string }>();
  const clinicasSoPelaPessoa = new Map<string, string>(); // organização citada na pessoa e ausente do arquivo
  let pessoasMescladas = 0;

  for (const r of p.registros) {
    const nomeBruto = limparNome(r[chave("Pessoa - Nome")] ?? "");
    if (!nomeBruto) continue;
    const pk = chave(semTitulo(nomeBruto));
    if (!pk) continue;
    const orgNome = limparNome(r[chave("Pessoa - Organização")] ?? "");
    let clinicaChave: string;

    if (orgNome) {
      const ko = chave(orgNome);
      clinicaChave = `org:${ko}`;
      if (!orgs.has(ko)) clinicasSoPelaPessoa.set(ko, orgNome);
    } else {
      const casada = orgPorNomeSemTitulo.get(pk);
      if (casada) clinicaChave = `org:${casada}`;
      else {
        clinicaChave = `pes:${pk}`;
        if (!clinicasAvulsas.has(clinicaChave)) clinicasAvulsas.set(clinicaChave, { nome: nomeBruto, tipo: "Profissional avulso" });
      }
    }

    const tel = lerTelefones(r[chave("Pessoa - Telefone - Trabalho")] ?? "");
    const outros = ["Pessoa - Telefone - Celular", "Pessoa - Telefone - Residencial", "Pessoa - Telefone - Outros"]
      .map((c) => lerTelefones(r[chave(c)] ?? ""))
      .flatMap((x) => x.telefones);
    const todos = [...tel.telefones, ...outros];
    const email = r[chave("Pessoa - E-mail - Trabalho")] || r[chave("Pessoa - E-mail - Residencial")] || r[chave("Pessoa - E-mail - Outros")] || "";

    const idPessoa = `pes:${pk}|${clinicaChave}`;
    const fechados = numero(r[chave("Pessoa - Negócios fechados")]);
    const abertos = numero(r[chave("Pessoa - Negócios em aberto")]);
    const existente = pessoas.get(idPessoa);
    if (existente) {
      pessoasMescladas++;
      existente.negociosFechados += fechados;
      existente.negociosAbertos += abertos;
      for (const t of todos) if (!existente.telefones.some((x) => x.numero === t.numero)) existente.telefones.push(t);
      if (!existente.email && email) existente.email = email;
      continue;
    }

    const avisos: string[] = tel.invalidos.map((x) => `número inválido: ${x}`);
    pessoas.set(idPessoa, {
      chave: idPessoa,
      nome: nomeBruto,
      titulo: tituloDe(nomeBruto),
      telefone: null,
      tipoTelefone: null,
      telefone2: null,
      email: email || null,
      origem: r[chave("Pessoa - Origem")] || null,
      negociosFechados: fechados,
      negociosAbertos: abertos,
      clinicaChave,
      observacoes: null,
      telefones: todos,
      avisos,
      clinicaNome: orgNome,
      clinicaNova: false,
    });
  }

  // Mesmo nome em organizações diferentes: é o caso "uma pessoa, várias
  // clínicas" ou um homônimo — a equipe decide, aqui só se avisa.
  const porNome = new Map<string, string[]>();
  for (const pe of pessoas.values()) {
    const pk = chave(semTitulo(pe.nome));
    if (pk.split(" ").length < 2) continue;
    porNome.set(pk, [...(porNome.get(pk) ?? []), pe.chave]);
  }
  for (const ids of porNome.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) pessoas.get(id)!.avisos.push(`mesmo nome em ${ids.length} clínicas — conferir se é a mesma pessoa`);
  }

  // Telefones e observações finais por pessoa.
  for (const pe of pessoas.values()) {
    const [t1, t2] = pe.telefones;
    if (t1) {
      pe.telefone = formatarNumero(t1.numero);
      pe.tipoTelefone = t1.tipo;
      if (t1.dddAssumido) pe.avisos.push("DDD 11 assumido");
    }
    if (t2) pe.telefone2 = formatarNumero(t2.numero);
    pe.observacoes = pe.avisos.length ? pe.avisos.join("; ") : null;
  }

  // Clínicas: as do arquivo, as só citadas por uma pessoa e as avulsas.
  const contagemPorClinica = new Map<string, PessoaBruta[]>();
  for (const pe of pessoas.values()) contagemPorClinica.set(pe.clinicaChave, [...(contagemPorClinica.get(pe.clinicaChave) ?? []), pe]);

  const clinicas: ClinicaCrm[] = [];
  const montar = (k: string, nome: string, tipoFixo: string | null, org: OrgBruta | null) => {
    const das = contagemPorClinica.get(k) ?? [];
    // O telefone da clínica é o do primeiro profissional que tem celular (serve
    // para WhatsApp); sem celular, o primeiro número que existir.
    const comCelular = das.find((x) => x.tipoTelefone === "Celular" && x.telefone);
    const telefone = (comCelular ?? das.find((x) => x.telefone))?.telefone ?? null;
    const avisos: string[] = [];
    if (org && org.cadastros > 1) avisos.push(`${org.cadastros} cadastros duplicados no PipeDrive, consolidados`);
    if (!org && !tipoFixo) avisos.push("organização citada na pessoa, mas ausente do arquivo de organizações");
    if (das.length === 0) avisos.push("nenhuma pessoa vinculada no arquivo de pessoas");
    clinicas.push({
      chave: k,
      nome,
      tipo: tipoFixo ?? tipoDaClinica(nome, das.length),
      telefone,
      endereco: lerEndereco(org?.endereco ?? ""),
      negociosFechados: org?.fechados ?? das.reduce((s, x) => s + x.negociosFechados, 0),
      negociosAbertos: org?.abertos ?? das.reduce((s, x) => s + x.negociosAbertos, 0),
      cadastrosOrigem: org?.cadastros ?? 1,
      avisos,
    });
  };
  for (const [ko, org] of orgs) montar(`org:${ko}`, org.nome, null, org);
  for (const [ko, nome] of clinicasSoPelaPessoa) montar(`org:${ko}`, nome, null, null);
  for (const [k, c] of clinicasAvulsas) montar(k, c.nome, c.tipo, null);

  const porTipo: Record<string, number> = {};
  for (const c of clinicas) porTipo[c.tipo] = (porTipo[c.tipo] ?? 0) + 1;
  const lista = Array.from(pessoas.values()).map(({ telefones: _t, avisos: _a, clinicaNome: _n, clinicaNova: _c, ...pe }) => pe);

  return {
    clinicas,
    pessoas: lista,
    resumo: {
      organizacoesNoArquivo: o.registros.filter((r) => r[chave("Organização - Nome")]).length,
      pessoasNoArquivo: p.registros.filter((r) => r[chave("Pessoa - Nome")]).length,
      clinicas: clinicas.length,
      clinicasComNegocioFechado: clinicas.filter((c) => c.negociosFechados > 0).length,
      duplicadasConsolidadas: Array.from(orgs.values()).reduce((s, x) => s + x.cadastros - 1, 0),
      pessoas: lista.length,
      pessoasDuplicadasMescladas: pessoasMescladas,
      clinicasDeProfissionalAvulso: clinicasAvulsas.size,
      clinicasSemProfissional: clinicas.filter((c) => !contagemPorClinica.has(c.chave)).length,
      pessoasComTelefone: lista.filter((x) => x.telefone).length,
      pessoasComCelular: lista.filter((x) => x.tipoTelefone === "Celular").length,
      pessoasComEmail: lista.filter((x) => x.email).length,
      porTipo,
    },
  };
}

// ─── Resultado da gravação ──────────────────────────────────────────────────

export type ResultadoExecucaoCrm = {
  clinicasNovas: number;
  /** Já tinham sido importadas antes (mesmo idCrm): não são tocadas. */
  clinicasJaImportadas: number;
  /** Uma clínica já cadastrada à mão com o mesmo nome: ganha a marca do CRM, sem duplicar. */
  clinicasAdotadas: number;
  pessoasNovas: number;
  pessoasJaImportadas: number;
  vinculosNovos: number;
};

export type EstadoImportacaoCrm = {
  etapa: "inicial" | "previa" | "concluida";
  erro?: string;
  resumo?: ResumoCrm;
  /** O que a gravação faria (prévia) ou fez (concluída). */
  execucao?: ResultadoExecucaoCrm;
};
