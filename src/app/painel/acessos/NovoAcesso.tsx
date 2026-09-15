"use client";

import { useState } from "react";
import { criarAcesso } from "@/app/actions/acessos";
import { FormularioAcesso } from "@/components/FormularioAcesso";
import { Campo, Rotulo, Selecao } from "@/components/ui";

export type Vinculo = { id: string; nome: string; email: string | null; temAcesso: boolean };

/**
 * Criação de acesso com o cadastro já escolhido.
 *
 * O nome e o e-mail vêm do cadastro assim que a clínica ou o profissional é
 * selecionado: redigitar o que já está no banco é como o acesso acaba criado
 * com o e-mail errado — e um e-mail errado aqui não é um campo errado, é uma
 * conta que a pessoa nunca consegue usar e a senha que foi ditada para
 * ninguém.
 */
export function NovoAcesso({ clinicas, profissionais }: { clinicas: Vinculo[]; profissionais: Vinculo[] }) {
  const [papel, setPapel] = useState("PROFISSIONAL");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");

  const lista = papel === "CLINICA" ? clinicas : papel === "PROFISSIONAL" ? profissionais : [];
  // Quem já tem acesso não entra na lista: o caminho para essa pessoa é
  // redefinir a senha, não criar um segundo login.
  const disponiveis = lista.filter((v) => !v.temAcesso);

  function escolherVinculo(id: string) {
    const escolhido = lista.find((v) => v.id === id);
    if (!escolhido) return;
    setNome(escolhido.nome);
    setEmail(escolhido.email ?? "");
  }

  return (
    <FormularioAcesso acao={criarAcesso} botao="Criar acesso e gerar senha">
      <div>
        <Rotulo>Nível de acesso</Rotulo>
        <Selecao
          name="papel"
          value={papel}
          onChange={(e) => {
            setPapel(e.target.value);
            setNome("");
            setEmail("");
          }}
        >
          <option value="PROFISSIONAL">Profissional</option>
          <option value="CLINICA">Clínica contratante</option>
          <option value="INTERNO">Equipe Hemoderi</option>
        </Selecao>
      </div>

      {papel === "INTERNO" ? (
        <>
          <input type="hidden" name="vinculoId" value="" />
          <div>
            <Rotulo>Perfil</Rotulo>
            <Selecao name="perfilInterno" defaultValue="ATENDENTE">
              <option value="ATENDENTE">Atendente — esteira e cadastros, sem financeiro nem acessos</option>
              <option value="RESPONSAVEL">Responsável — também vê o repasse e gerencia acessos</option>
            </Selecao>
          </div>
        </>
      ) : (
        <div>
          <Rotulo>{papel === "CLINICA" ? "Clínica" : "Profissional"}</Rotulo>
          <Selecao name="vinculoId" defaultValue="" onChange={(e) => escolherVinculo(e.target.value)} required>
            <option value="">— selecione —</option>
            {disponiveis.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
                {v.email ? "" : " (sem e-mail no cadastro)"}
              </option>
            ))}
          </Selecao>
          {disponiveis.length === 0 && (
            <div className="text-[10px] text-gray-400 mt-1">
              Todos os cadastros ativos deste tipo já têm acesso.
            </div>
          )}
        </div>
      )}

      <div>
        <Rotulo>Nome</Rotulo>
        <Campo name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div>
        <Rotulo>E-mail (é com ele que a pessoa entra)</Rotulo>
        <Campo name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <div className="text-[10px] text-gray-400 leading-relaxed">
        A senha é sorteada pelo sistema e aparece aqui uma vez, para você repassar.
        Na primeira entrada a pessoa é obrigada a escolher a senha dela — nem você
        nem ninguém da equipe fica sabendo qual é.
      </div>
    </FormularioAcesso>
  );
}
