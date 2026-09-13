# Cronograma de implantação

Fases conforme a Cláusula 3 da proposta DT-2026-HMD-001-R2. Os prazos contam a
partir do recebimento integral dos insumos da Fase 0 — atraso no envio desloca
o cronograma na mesma proporção (Cláusula 12).

O **Dilon Zap** (Frente 1, central de atendimento no WhatsApp) é produto
multiempresa e vive em repositório próprio. Este repositório é a Frente 2:
Dilon Saúde | Operações.

| Fase | Prazo | Entrega | Estado |
| --- | --- | --- | --- |
| Fase 0 | Semana 1 | Insumos e desenho: fluxo mapeado e regras de repasse validadas | insumos pendentes |
| Fase 1 | Semanas 1–3 | Dilon Zap no ar | outro repositório |
| Fase 2 | Semanas 4–9 | Núcleo operacional: agenda central, esteira de alocação, três níveis de acesso | **implementado** |
| Fase 3 | Semanas 10–14 | Portais e financeiro | **implementado** |
| Fase 4 | Semanas 15–16 | Integrações e go-live | desenhado, desligado |

## O que já está de pé

**Módulo 01 — esteira de agendamento e alocação.** Cadastro de clínicas,
serviços e equipamentos; agendamento híbrido (interno e pelo portal); alocação
com as quatro travas (profissional, equipamento, sala, disponibilidade);
controle de status ponta a ponta.

**Módulo 02 — portal do cliente.** Agendamento 24h com escolha de serviço,
profissional e horário; histórico dos próprios pedidos; reagendamento e
cancelamento pela própria clínica, dentro da janela de antecedência; link
curto e QR Code de divulgação por clínica.

O profissional escolhido no portal fica gravado no pedido como **reserva
provisória**: já segura o horário dele, mas o compromisso só existe quando a
equipe aloca. Segurar é de propósito — duas clínicas pedindo o mesmo horário e
as duas recebendo "ok" é pior do que a segunda ver o horário indisponível na
hora.

**Módulo 03 — portal do profissional.** Agenda individual, declaração de
disponibilidade e ausências, relatório pós-atendimento, ganhos realizados e a
receber abertos linha a linha. O relatório pede a localização do navegador no
momento do envio (nunca antes, e nunca trava sem ela) — confirma presença no
local; a equipe vê o selo "local confirmado" na esteira quando ela veio.

**Acessos.** Ativação e desativação por login (`Usuario`), independente de
desativar a clínica ou o profissional por trás — um funcionário que sai não
precisa levar o cadastro inteiro junto. O corte vale na hora: as três guardas
de acesso reconferem o banco a cada navegação, então uma sessão já aberta é
cortada no próximo clique, não só no próximo login. Ninguém desativa a
própria conta.

**Módulo 04 — financeiro e relatórios.** Repasse calculado a partir do
relatório; a receber e a pagar em visões separadas; painel diário com
atendimentos, faturamento, margem, produtividade por profissional e taxa de
comparecimento; exportação mensal em CSV.
*A rever:* a lista de indicadores do painel, com a equipe, depois de duas
semanas de uso real — indicador escolhido antes do uso vira gráfico que
ninguém abre.

## Fase 4 — o que falta ligar

As três integrações estão escritas e desligadas. Sem as variáveis de ambiente
elas registram a intenção em `SincronizacaoExterna` em vez de falhar em
silêncio ou fingir sucesso.

| Integração | O que falta | Onde |
| --- | --- | --- |
| PipeDrive | token e domínio da conta; confirmar em qual campo do negócio guardar o número do pedido | `src/lib/integracoes/pipedrive.ts` |
| Google Agenda | conta de serviço com acesso à agenda da equipe; a chamada HTTP (o formato do evento já está fechado) | `src/lib/integracoes/google-agenda.ts` |
| WhatsApp | endpoint de envio do Dilon Zap; substituir os textos-esqueleto pelos modelos reais da operação | `src/lib/integracoes/whatsapp.ts` |

A rotina de lembretes já roda de hora em hora (`vercel.json` → `crons`) e é
idempotente: quando o endpoint de envio existir, ela passa a entregar sem
nenhuma outra mudança.

## Publicar

O passo a passo está em [`deploy.md`](deploy.md): Neon na região de São Paulo,
Vercel em `gru1`, migrations aplicadas sozinhas no build e `/api/saude` para
conferir o resultado em um comando.

## Antes do go-live

- [ ] Preencher parâmetros reais da operação (`Parametros`): horário de
      funcionamento, antecedência mínima do portal, janela de lembrete,
      percentual de repasse padrão e prazo de faturamento.
- [ ] Carregar serviços, equipamentos e a tabela de preço por clínica.
- [ ] Cadastrar os 60 profissionais e criar os acessos.
- [ ] Criar os acessos das clínicas contratantes.
- [ ] Confirmar o repositório privado (Cláusula 6.1 — hoje o repositório está
      público).
- [ ] Definir o terceiro depositário do escrow trimestral (Cláusula 6.1.1).
- [ ] Treinamento da equipe interna e material curto para clínicas e
      profissionais.
- [ ] Definir o domínio final ANTES de imprimir os QR Codes: o link do QR sai
      de `NEXTAUTH_URL`, e trocar o domínio depois invalida o que já foi
      distribuído.
