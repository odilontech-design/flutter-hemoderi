import { randomUUID } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { gerarSlug } from "./slug";
import { chave, type PlanoCrm, type ResultadoExecucaoCrm } from "./crm";

/**
 * Grava (ou simula) o plano do CRM como PRÉ-CADASTROS.
 *
 * Pré-cadastro = clínica `ativa: false` e `preCadastro: true`, sem usuário: a
 * equipe enxerga e ativa quando o cliente aparece, mas nada na operação (agenda,
 * novo pedido, NPS, financeiro) passa a enxergá-la — todas essas telas já
 * filtram por `ativa`. Nenhum acesso é criado.
 *
 * Repetível: a chave do CRM (idCrm) impede duplicar. O que já foi importado não
 * é reescrito (a equipe pode ter corrigido o cadastro depois). Uma clínica já
 * cadastrada à mão com o mesmo nome é ADOTADA — ganha a marca do CRM e os
 * números de negócios, nada além disso — em vez de ganhar uma irmã duplicada.
 *
 * Tudo numa transação: ou entra a base inteira ou nada.
 */
export async function executarPlanoCrm(
  db: PrismaClient,
  plano: PlanoCrm,
  aplicar: boolean
): Promise<ResultadoExecucaoCrm> {
  const [clinicas, pessoas] = await Promise.all([
    db.clinica.findMany({ select: { id: true, nome: true, slug: true, idCrm: true } }),
    db.pessoaCliente.findMany({ select: { id: true, idCrm: true } }),
  ]);

  const clinicaPorIdCrm = new Map(clinicas.filter((c) => c.idCrm).map((c) => [c.idCrm as string, c.id]));
  const semMarca = new Map<string, string[]>();
  for (const c of clinicas.filter((x) => !x.idCrm)) {
    const k = chave(c.nome);
    semMarca.set(k, [...(semMarca.get(k) ?? []), c.id]);
  }
  const pessoaPorIdCrm = new Map(pessoas.map((p) => [p.idCrm, p.id]));
  const slugsUsados = new Set(clinicas.map((c) => c.slug));

  const slugLivre = (nome: string) => {
    const base = gerarSlug(nome) || "cliente";
    let slug = base;
    for (let n = 2; slugsUsados.has(slug); n++) slug = `${base}-${n}`;
    slugsUsados.add(slug);
    return slug;
  };

  const resultado: ResultadoExecucaoCrm = {
    clinicasNovas: 0,
    clinicasJaImportadas: 0,
    clinicasAdotadas: 0,
    pessoasNovas: 0,
    pessoasJaImportadas: 0,
    vinculosNovos: 0,
  };

  const idDaClinica = new Map<string, string>(clinicaPorIdCrm);
  const novas: Prisma.ClinicaCreateManyInput[] = [];
  const adotar: { id: string; chave: string; fechados: number; abertos: number; tipo: string }[] = [];

  for (const c of plano.clinicas) {
    if (clinicaPorIdCrm.has(c.chave)) {
      resultado.clinicasJaImportadas++;
      continue;
    }
    const iguais = semMarca.get(chave(c.nome)) ?? [];
    // Só adota quando há UMA candidata: com duas homônimas não há como saber
    // qual é a do CRM, e escolher errado mistura histórico de clientes.
    if (iguais.length === 1) {
      const id = iguais[0];
      idDaClinica.set(c.chave, id);
      adotar.push({ id, chave: c.chave, fechados: c.negociosFechados, abertos: c.negociosAbertos, tipo: c.tipo });
      semMarca.delete(chave(c.nome));
      resultado.clinicasAdotadas++;
      continue;
    }
    const id = randomUUID();
    idDaClinica.set(c.chave, id);
    resultado.clinicasNovas++;
    novas.push({
      id,
      nome: c.nome,
      slug: slugLivre(c.nome),
      telefone: c.telefone,
      endereco: c.endereco.endereco,
      numero: c.endereco.numero,
      complemento: c.endereco.complemento,
      bairro: c.endereco.bairro,
      cidade: c.endereco.cidade,
      uf: c.endereco.uf,
      cep: c.endereco.cep,
      observacoes: c.avisos.length ? `CRM: ${c.avisos.join("; ")}` : null,
      preCadastro: true,
      ativa: false,
      idCrm: c.chave,
      tipoCrm: c.tipo,
      negociosFechadosCrm: c.negociosFechados,
      negociosAbertosCrm: c.negociosAbertos,
    });
  }

  const novasPessoas: Prisma.PessoaClienteCreateManyInput[] = [];
  const vinculos: { pessoaId: string; clinicaId: string }[] = [];
  for (const p of plano.pessoas) {
    const clinicaId = idDaClinica.get(p.clinicaChave);
    if (!clinicaId) continue;
    const existente = pessoaPorIdCrm.get(p.chave);
    if (existente) {
      resultado.pessoasJaImportadas++;
      vinculos.push({ pessoaId: existente, clinicaId });
      continue;
    }
    const id = randomUUID();
    resultado.pessoasNovas++;
    novasPessoas.push({
      id,
      idCrm: p.chave,
      nome: p.nome,
      titulo: p.titulo,
      telefone: p.telefone,
      tipoTelefone: p.tipoTelefone,
      telefone2: p.telefone2,
      email: p.email,
      origemCrm: p.origem,
      negociosFechados: p.negociosFechados,
      negociosAbertos: p.negociosAbertos,
      observacoes: p.observacoes,
    });
    vinculos.push({ pessoaId: id, clinicaId });
  }
  resultado.vinculosNovos = vinculos.length;

  if (!aplicar) return resultado;

  const lote = <T>(itens: T[], tamanho = 500) =>
    Array.from({ length: Math.ceil(itens.length / tamanho) }, (_, i) => itens.slice(i * tamanho, (i + 1) * tamanho));

  await db.$transaction(
    async (tx) => {
      for (const parte of lote(novas)) await tx.clinica.createMany({ data: parte });
      for (const a of adotar) {
        await tx.clinica.update({
          where: { id: a.id },
          data: { idCrm: a.chave, tipoCrm: a.tipo, negociosFechadosCrm: a.fechados, negociosAbertosCrm: a.abertos },
        });
      }
      for (const parte of lote(novasPessoas)) await tx.pessoaCliente.createMany({ data: parte });
      for (const parte of lote(vinculos)) await tx.vinculoPessoaClinica.createMany({ data: parte, skipDuplicates: true });
    },
    { timeout: 120_000, maxWait: 20_000 }
  );

  return resultado;
}
