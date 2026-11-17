import type { Metadata } from "next";
import { PaginaPublica } from "@/components/PaginaPublica";
import { CONTATO_DE_PRIVACIDADE } from "@/lib/privacidade";

export const metadata: Metadata = { title: "Excluir conta · Hemoderi" };

/** Pública: a Google Play pede uma URL que explique como excluir a conta e os dados. */
export default function ExclusaoDeConta() {
  return (
    <PaginaPublica titulo="Como excluir a sua conta" subtitulo="App Hemoderi — Clínica e Profissional">
      <section>
        <h2 className="font-semibold text-bordo mb-1">Pelo app (o jeito mais rápido)</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Entre no app com o seu e-mail e senha.</li>
          <li>Clínica: abra <strong>Configurações</strong>. Profissional: abra <strong>Meus dados</strong>.</li>
          <li>Toque em <strong>Excluir minha conta</strong>, digite a senha e confirme.</li>
        </ol>
        <p className="mt-2">O acesso é encerrado na hora e o seu nome, e-mail e telefone são apagados.</p>
      </section>
      <section>
        <h2 className="font-semibold text-bordo mb-1">Quando a exclusão precisa esperar</h2>
        <p>
          Profissionais com atendimentos alocados daqui para frente, e clínicas que são o único acesso e têm agendamentos futuros, precisam
          remanejar ou cancelar antes. O app avisa o motivo.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-bordo mb-1">O que é apagado e o que é mantido</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Apagado:</strong> nome, e-mail, telefone, senha, aparelhos de notificação e a agenda do Google conectada.</li>
          <li><strong>Mantido pelo prazo legal:</strong> o histórico de atendimentos, relatórios, repasses e cobranças, que a lei manda guardar. Ele deixa de estar ligado à sua conta.</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-bordo mb-1">Sem acesso ao app?</h2>
        <p>
          Escreva para <a className="underline" href={`mailto:${CONTATO_DE_PRIVACIDADE}`}>{CONTATO_DE_PRIVACIDADE}</a> com o e-mail da conta e peça a
          exclusão. Responderemos pelos meios de contato cadastrados.
        </p>
      </section>
      <p className="text-xs text-gray-500">
        Veja também a <a className="underline" href="/privacidade">política de privacidade</a>.
      </p>
    </PaginaPublica>
  );
}
