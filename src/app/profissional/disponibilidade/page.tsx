import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Selecao, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import {
  adicionarDisponibilidade,
  marcarAusencia,
  removerAusencia,
  removerDisponibilidade,
  salvarAgendaDoGoogle,
} from "@/app/actions/disponibilidade";
import { formatarData } from "@/lib/data";
import { rotuloDaJanela, TURNOS } from "@/lib/turnos";

export const dynamic = "force-dynamic";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function Disponibilidade() {
  const sessao = await exigirProfissional();

  const [janelas, ausencias, eu] = await Promise.all([
    prisma.disponibilidade.findMany({
      where: { profissionalId: sessao.profissionalId },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.bloqueio.findMany({
      where: { profissionalId: sessao.profissionalId, data: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { data: "asc" },
    }),
    prisma.profissional.findUnique({
      where: { id: sessao.profissionalId },
      select: { googleAgendaId: true },
    }),
  ]);

  const contaDeServico = process.env.GOOGLE_CLIENT_EMAIL ?? null;

  return (
    <>
      <Titulo>Disponibilidade</Titulo>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-1">Minha semana</div>
          <div className="text-[11px] text-gray-500 mb-3">
            A central só oferece você em horários dentro dessas janelas.
          </div>

          {janelas.length === 0 ? (
            <Vazio>Nenhuma janela declarada — você não aparece para a central alocar.</Vazio>
          ) : (
            <div className="space-y-1 mb-4">
              {janelas.map((janela) => (
                <div key={janela.id} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 pb-1.5 last:border-0">
                  <span>
                    <strong className="text-bordo">{DIAS[janela.diaSemana]}</strong> ·{" "}
                    {rotuloDaJanela(janela.horaInicio, janela.horaFim)}
                  </span>
                  <BotaoAcao acao={removerDisponibilidade.bind(null, janela.id)} variante="perigo">
                    Remover
                  </BotaoAcao>
                </div>
              ))}
            </div>
          )}

          <FormularioAcao acao={adicionarDisponibilidade} botao="Adicionar disponibilidade">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Rotulo>Dia</Rotulo>
                <Selecao name="diaSemana" defaultValue="1">
                  {DIAS.map((dia, indice) => (
                    <option key={dia} value={indice}>
                      {dia}
                    </option>
                  ))}
                </Selecao>
              </div>
              <div>
                <Rotulo>Turno</Rotulo>
                <Selecao name="turno" defaultValue="MANHA">
                  {TURNOS.map((turno) => (
                    <option key={turno.chave} value={turno.chave}>
                      {turno.rotulo} ({turno.horaInicio}–{turno.horaFim})
                    </option>
                  ))}
                </Selecao>
              </div>
            </div>
            <div className="text-[10px] text-gray-400">
              O dia inteiro vale o horário de funcionamento da operação. A manhã é onde a central
              mais precisa de gente.
            </div>
          </FormularioAcao>
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-1">Ausências</div>
          <div className="text-[11px] text-gray-500 mb-3">
            Vence a janela da semana em um dia específico. Não cancela atendimento já alocado — para
            isso, avise a central.
          </div>

          {ausencias.length === 0 ? (
            <Vazio>Nenhuma ausência marcada.</Vazio>
          ) : (
            <div className="space-y-1 mb-4">
              {ausencias.map((ausencia) => (
                <div key={ausencia.id} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 pb-1.5 last:border-0">
                  <span>
                    <strong className="text-bordo">{formatarData(ausencia.data)}</strong>{" "}
                    {ausencia.horaInicio ? `· ${ausencia.horaInicio}–${ausencia.horaFim}` : "· dia inteiro"}
                    {ausencia.motivo ? ` · ${ausencia.motivo}` : ""}
                  </span>
                  <BotaoAcao acao={removerAusencia.bind(null, ausencia.id)} variante="perigo">
                    Remover
                  </BotaoAcao>
                </div>
              ))}
            </div>
          )}

          <FormularioAcao acao={marcarAusencia} botao="Marcar ausência">
            <div>
              <Rotulo>Data</Rotulo>
              <Campo name="data" type="date" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>Das (opcional)</Rotulo>
                <Campo name="horaInicio" type="time" />
              </div>
              <div>
                <Rotulo>Às (opcional)</Rotulo>
                <Campo name="horaFim" type="time" />
              </div>
            </div>
            <div>
              <Rotulo>Motivo (opcional)</Rotulo>
              <Campo name="motivo" />
            </div>
            <div className="text-[10px] text-gray-400">Sem horário, o dia inteiro fica bloqueado.</div>
          </FormularioAcao>
        </Cartao>

        <Cartao className="lg:col-span-2">
          <div className="font-display font-bold text-bordo text-sm mb-1">Minha agenda do Google</div>
          <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            Conectada, cada atendimento seu vira compromisso na sua agenda — no seu celular, com o
            seu lembrete. Remarcação muda o evento; cancelamento e troca de profissional tiram ele
            de lá. Você continua vendo tudo aqui no portal; a agenda do Google é a cópia que anda
            junto com você.
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-[11px] text-gray-600 leading-relaxed">
            <strong className="text-bordo">Como conectar, uma vez só:</strong>
            <ol className="list-decimal pl-4 mt-1 space-y-0.5">
              <li>Abra o Google Agenda no computador.</li>
              <li>
                Nas três bolinhas ao lado da sua agenda, vá em{" "}
                <em>Configurações e compartilhamento</em>.
              </li>
              <li>
                Em <em>Compartilhar com pessoas específicas</em>, adicione{" "}
                {contaDeServico ? (
                  <code className="bg-white px-1 rounded break-all">{contaDeServico}</code>
                ) : (
                  <span className="text-amber-700">
                    o endereço da conta de serviço (peça à central — a integração ainda não foi
                    configurada neste ambiente)
                  </span>
                )}{" "}
                com a permissão <strong>Fazer alterações nos eventos</strong>.
              </li>
              <li>Volte aqui e informe o e-mail da sua conta Google abaixo.</li>
            </ol>
          </div>

          <FormularioAcao
            acao={salvarAgendaDoGoogle}
            botao={eu?.googleAgendaId ? "Atualizar agenda" : "Conectar agenda"}
            limparAoSalvar={false}
          >
            <div>
              <Rotulo>E-mail da sua conta Google</Rotulo>
              <Campo
                name="googleAgendaId"
                type="email"
                defaultValue={eu?.googleAgendaId ?? ""}
                placeholder="voce@gmail.com"
              />
              <div className="text-[10px] text-gray-400 mt-1">
                {eu?.googleAgendaId
                  ? "Para desconectar, apague o campo e salve — os atendimentos somem da sua agenda do Google e continuam aqui."
                  : "Sem conectar, seus atendimentos aparecem só aqui no portal."}
              </div>
            </div>
          </FormularioAcao>
        </Cartao>
      </div>
    </>
  );
}
