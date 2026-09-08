# Dilon Saúde | Operações — Hemoderi

Sistema de operação da Hemoderi: **esteira de agendamento, alocação de
profissional e equipamento, portais de autoatendimento e controle de repasses**.

A Hemoderi coloca profissional e equipamento dentro da clínica do cliente.
Quem paga é a clínica contratante; quem executa é o profissional autônomo. É
uma operação logística de gente e aparelho, não um consultório — e é essa
diferença que decide o modelo de dados inteiro.

Vertical **dedicada**: este banco atende uma operação só. Não há coluna de
tenant e não deve haver.

## Por que não serve uma agenda genérica

Um sistema de agendamento comum responde "esse horário está livre?". A
Hemoderi precisa de outra resposta: **dá para cumprir esse atendimento?** São
quatro recursos disputados ao mesmo tempo, e ignorar qualquer um produz um
agendamento que a operação não consegue honrar:

**O profissional não se divide.** Óbvio, e é a única trava que a maioria dos
sistemas implementa.

**O equipamento é contável e viaja junto.** Dois atendimentos simultâneos de
um serviço que exige aparelho precisam de dois aparelhos. Aparelho em
manutenção sai da conta no mesmo instante.

**A sala da clínica também é finita.** A clínica do briefing tem 10 salas:
dois atendimentos ao mesmo tempo no mesmo endereço são normais, onze não são.
Um sistema que trate a clínica como recurso único bloqueia agendamento
legítimo; um que a ignore aceita mais gente do que cabe.

**A disponibilidade é declarada pelo profissional.** São 60 profissionais em
modelo de disponibilidade livre. Alocar 1.500 atendimentos por mês sem
disponibilidade declarada é fazer 1.500 ligações perguntando "você pode?" —
que é exatamente o gargalo que impede sair dos 400 de hoje.

E há a regra que amarra o financeiro: **o repasse nasce do relatório
pós-atendimento, e só dele.** Realizado gera, falta não gera. O que aparece
em "a pagar" passou por um relatório que alguém assinou.

## O que tem dentro

| Módulo | O que resolve |
| --- | --- |
| **Esteira de pedidos** | Ciclo ponta a ponta: solicitado → confirmado → alocado → realizado/faltou, com a fila do que está parado esperando alguém |
| **Alocação** | Profissional, equipamento, sala e disponibilidade verificados juntos; o que trava, trava, e o que é combinável vira aviso |
| **Portal da clínica** | Agendamento 24h com horários que a operação consegue cumprir, histórico e acompanhamento dos próprios pedidos |
| **Portal do profissional** | Agenda individual, declaração de disponibilidade, ausências, relatório pós-atendimento e ganhos abertos linha a linha |
| **Financeiro** | A receber das clínicas e a pagar aos profissionais como duas contas separadas, com a margem entre elas |
| **Fechamento** | Fatura por clínica e competência, baixa de repasses em lote e exportação mensal em CSV para a contabilidade |
| **Automações** | Fila de WhatsApp para confirmação, alocação, lembrete e resultado, com rastro de envio |

### Os três níveis de acesso

| Nível | Caminho | Enxerga |
| --- | --- | --- |
| Equipe Hemoderi | `/painel` | a operação inteira: esteira, agenda, cadastros, financeiro e acessos |
| Clínica contratante | `/portal` | os próprios pedidos e o valor cobrado — nunca o repasse do profissional |
| Profissional | `/profissional` | a própria agenda, a própria disponibilidade e os próprios ganhos |

O escopo **sempre** vem da conta autenticada, nunca de um id no formulário ou
na URL. É o que impede uma clínica ler os pedidos de outra trocando um
parâmetro.

## Decisões que valem explicar

**Dinheiro em centavos inteiros.** O repasse é percentual sobre o valor do
serviço e o mês fecha somando centenas dessas contas. Em ponto flutuante o
resto de centavo se acumula e a soma da tela deixa de bater com o relatório
que o profissional conferiu.

**O dia do atendimento é meia-noite UTC; a hora vive separada, em texto.** O
processo roda em UTC na Vercel e no fuso de São Paulo na máquina de quem
desenvolve. Sem isso, um atendimento das 21h aparece no dia seguinte em
produção e no dia certo em desenvolvimento.

**Valor e duração são congelados no pedido.** Reajuste de tabela e mudança de
duração não reescrevem o que já foi combinado.

**A cadeia de repasse tem quatro degraus** (`src/lib/repasse.ts`), do mais
específico para o mais genérico: acerto do par profissional × serviço → regra
do serviço → percentual do profissional → padrão da operação. A função devolve
qual degrau respondeu, porque quando o profissional questiona o valor a
resposta precisa ter origem.

**Mensagem é gravada antes de ser enviada.** Falha fica visível para reenvio,
e a rotina de lembretes pode rodar de hora em hora sem duplicar nada.

**O PipeDrive continua sendo a fonte do histórico comercial.** A única escrita
prevista é marcar o negócio como ganho no fim do processo. Duas fontes
editáveis do mesmo dado comercial divergem em semanas.

## Como rodar

```bash
npm install
cp .env.example .env        # preencha DATABASE_URL (Neon) e NEXTAUTH_SECRET
npm run db:migrate          # cria o schema
npm run db:seed             # dados de exemplo para navegar as três telas
npm run dev                 # http://localhost:3003
```

Acessos criados pelo seed (senha `hemoderi123`):

| Nível | E-mail |
| --- | --- |
| Equipe | `equipe@hemoderi.com.br` |
| Clínica | `clinica-santa-rita@exemplo.com.br` |
| Profissional | `ana@exemplo.com.br` |

Em produção, o primeiro acesso interno é criado pela linha de comando — quem
cria um usuário interno enxerga a operação inteira, e essa porta não se abre
pela internet:

```bash
npm run db:usuario -- --email=voce@hemoderi.com.br --nome="Seu Nome" --senha='...' --papel=INTERNO
```

### Verificação

```bash
npm test        # regras puras: agenda, repasse, dinheiro, esteira
npm run typecheck
npm run build
```

Os testes cobrem o que é fácil de quebrar sem perceber: sobreposição de
horários, emenda de janelas de disponibilidade, a cadeia de repasse e as
transições permitidas da esteira.

## Onde fica o quê

```
prisma/schema.prisma        modelo do domínio, com o porquê de cada decisão
src/lib/agenda.ts           aritmética de agenda, sem banco — é o que os testes cobrem
src/lib/alocacao.ts         as quatro travas juntas, consultando o banco
src/lib/repasse.ts          a cadeia de regras de repasse
src/lib/pedido.ts           a máquina de status da esteira
src/lib/sessao.ts           as guardas dos três níveis de acesso
src/app/painel/             equipe Hemoderi
src/app/portal/             clínica contratante
src/app/profissional/       prestador
src/lib/integracoes/        PipeDrive, Google Agenda e WhatsApp
```

## Estado e próximos passos

O núcleo operacional e os dois portais estão de pé; as integrações externas
estão desenhadas e desligadas até a Fase 4 — sem as variáveis de ambiente elas
registram a intenção em `SincronizacaoExterna` em vez de fingir sucesso.

O cronograma por fase está em [`docs/roadmap.md`](docs/roadmap.md), e o que
precisa vir da Hemoderi para destravar a Fase 0 está em
[`docs/fase-0-insumos.md`](docs/fase-0-insumos.md).
