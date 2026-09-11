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
} from "@/app/actions/disponibilidade";
import { formatarData } from "@/lib/data";

export const dynamic = "force-dynamic";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function Disponibilidade() {
  const sessao = await exigirProfissional();

  const [janelas, ausencias] = await Promise.all([
    prisma.disponibilidade.findMany({
      where: { profissionalId: sessao.profissionalId },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.bloqueio.findMany({
      where: { profissionalId: sessao.profissionalId, data: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { data: "asc" },
    }),
  ]);

  return (
    <>
      <Titulo>Disponibilidade</Titulo>

      <div className="grid lg:grid-cols-2 gap-3">
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
                    <strong className="text-bordo">{DIAS[janela.diaSemana]}</strong> · {janela.horaInicio} às{" "}
                    {janela.horaFim}
                  </span>
                  <BotaoAcao acao={removerDisponibilidade.bind(null, janela.id)} variante="perigo">
                    Remover
                  </BotaoAcao>
                </div>
              ))}
            </div>
          )}

          <FormularioAcao acao={adicionarDisponibilidade} botao="Adicionar janela">
            <div className="grid grid-cols-3 gap-2">
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
                <Rotulo>Das</Rotulo>
                <Campo name="horaInicio" type="time" required defaultValue="08:00" />
              </div>
              <div>
                <Rotulo>Às</Rotulo>
                <Campo name="horaFim" type="time" required defaultValue="12:00" />
              </div>
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
      </div>
    </>
  );
}
