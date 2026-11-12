import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, Rotulo, Campo, Titulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CampoTelefone } from "@/components/CampoTelefone";
import { salvarMeusDados } from "@/app/actions/meus-dados";
import { falhasNaAgendaDoProfissional } from "@/lib/integracoes/google-agenda";

export const dynamic = "force-dynamic";

/** Um dado que só a central altera, mostrado para conferência. */
function Fixo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <div className="text-[10px] text-gray-400">{rotulo}</div>
      <div className="text-xs text-gray-700">{valor || "—"}</div>
    </div>
  );
}

/**
 * Meus dados (ata de 20/10): o profissional mantém o próprio contato e a
 * conexão com a agenda do Google, sem depender da equipe — e, desde a ata de
 * 04/11, a chave Pix. O que identifica a pessoa (nome, CPF, registro) fica à
 * vista, mas só a central altera.
 */
export default async function MeusDados() {
  const sessao = await exigirProfissional();
  const eu = await prisma.profissional.findUnique({
    where: { id: sessao.profissionalId },
    select: {
      nome: true,
      cpf: true,
      email: true,
      telefone: true,
      conselho: true,
      registro: true,
      especialidade: true,
      chavePix: true,
      googleAgendaId: true,
    },
  });
  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.usuarioId }, select: { email: true } });
  const contaDeServico = process.env.GOOGLE_CLIENT_EMAIL ?? null;
  const falhasNaAgenda = eu?.googleAgendaId ? await falhasNaAgendaDoProfissional(sessao.profissionalId) : 0;

  return (
    <>
      <Titulo>Meus dados</Titulo>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl">
        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-3">Contato e agenda</div>
          <FormularioAcao acao={salvarMeusDados} botao="Salvar meus dados" limparAoSalvar={false}>
            <div>
              <Rotulo>E-mail</Rotulo>
              <Campo name="email" type="email" required defaultValue={usuario?.email ?? eu?.email ?? ""} autoComplete="email" />
              <div className="text-[10px] text-gray-400 mt-1">É também o e-mail com que você entra no portal.</div>
            </div>
            <div>
              <Rotulo>Telefone (WhatsApp)</Rotulo>
              <CampoTelefone name="telefone" inicial={eu?.telefone ?? ""} obrigatorio />
            </div>
            <div>
              <Rotulo>Chave Pix para receber os repasses</Rotulo>
              <Campo
                name="chavePix"
                defaultValue={eu?.chavePix ?? ""}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                maxLength={140}
                autoComplete="off"
              />
            </div>
            <div>
              <Rotulo>Confirme a chave Pix (só ao informar ou trocar)</Rotulo>
              <Campo name="chavePixConfirmacao" placeholder="Digite a chave de novo" maxLength={140} autoComplete="off" />
              <div className="text-[10px] text-amber-700 mt-1">
                Confira com cuidado: o próximo repasse vai para esta chave. A central é avisada da troca.
              </div>
            </div>
            <div>
              <Rotulo>Agenda do Google (opcional)</Rotulo>
              <Campo name="googleAgendaId" type="email" defaultValue={eu?.googleAgendaId ?? ""} placeholder="voce@gmail.com" />
              <div className="text-[10px] text-gray-400 mt-1">
                {eu?.googleAgendaId
                  ? "Conectada: cada atendimento que você aceita vira compromisso nessa agenda. Para desconectar, apague e salve."
                  : "Sem conectar, seus atendimentos aparecem só aqui no portal."}
              </div>
              {falhasNaAgenda > 0 && (
                <div className="text-[11px] text-amber-700 mt-1">
                  Não conseguimos colocar seus atendimentos nessa agenda. Confira se ela foi compartilhada com a conta indicada ao lado,
                  com a permissão &quot;Fazer alterações nos eventos&quot;. Depois disso, os próximos atendimentos aceitos entram sozinhos.
                </div>
              )}
            </div>
          </FormularioAcao>
        </Cartao>

        <div className="space-y-3">
          <Cartao>
            <div className="font-display font-bold text-bordo text-sm mb-1">Como conectar a agenda do Google</div>
            <div className="text-[11px] text-gray-500 mb-2">
              Uma vez só. Depois, remarcação muda o evento e cancelamento tira ele da sua agenda.
            </div>
            <ol className="list-decimal pl-4 text-[11px] text-gray-600 leading-relaxed space-y-0.5">
              <li>Abra o Google Agenda no computador.</li>
              <li>
                Nas três bolinhas ao lado da sua agenda, vá em <em>Configurações e compartilhamento</em>.
              </li>
              <li>
                Em <em>Compartilhar com pessoas específicas</em>, adicione{" "}
                {contaDeServico ? (
                  <code className="bg-gray-50 px-1 rounded break-all">{contaDeServico}</code>
                ) : (
                  <span className="text-amber-700">o endereço que a central vai te passar</span>
                )}{" "}
                com a permissão <strong>Fazer alterações nos eventos</strong>.
              </li>
              <li>Volte aqui, informe o e-mail da sua conta Google e salve.</li>
            </ol>
          </Cartao>

          <Cartao>
            <div className="font-display font-bold text-bordo text-sm mb-1">Cadastro</div>
            <div className="text-[11px] text-gray-500 mb-3">
              Para corrigir algum destes dados, fale com a central — são eles que identificam você.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fixo rotulo="Nome" valor={eu?.nome ?? null} />
              <Fixo rotulo="CPF" valor={eu?.cpf ?? null} />
              <Fixo rotulo="Conselho e registro" valor={[eu?.conselho, eu?.registro].filter(Boolean).join(" ") || null} />
              <Fixo rotulo="Especialidade" valor={eu?.especialidade ?? null} />
            </div>
          </Cartao>
        </div>
      </div>
    </>
  );
}
