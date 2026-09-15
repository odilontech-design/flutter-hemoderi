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
| **Portal da clínica** | Agendamento 24h com horários que a operação consegue cumprir, reagendamento e cancelamento pela própria clínica, histórico e link/QR Code de divulgação |
| **Portal do profissional** | Agenda individual, declaração de disponibilidade, ausências, relatório pós-atendimento e ganhos abertos linha a linha |
| **Financeiro** | A receber das clínicas e a pagar aos profissionais como duas contas separadas, com a margem entre elas |
| **Painel do dia** | O que acontece hoje, o que está parado esperando alguém, produtividade por profissional e taxa de comparecimento |
| **Fechamento** | Fatura por clínica e competência, baixa de repasses em lote e exportação mensal em CSV para a contabilidade |
| **Automações** | Fila de WhatsApp para confirmação, alocação, lembrete e resultado, com rastro de envio |
| **Avaliação** | A clínica dá de 1 a 5 estrelas e um comentário depois do atendimento; a equipe vê a média por profissional |
| **Google Agenda** | Cada atendimento vira evento na agenda do Google do profissional — remarcar atualiza, cancelar apaga, trocar de profissional move |
| **Importação em lote** | A planilha de profissionais vira cadastro e acesso com senha provisória, colada direto na tela |
| **Agendamento público** | Quem ainda não é cliente escolhe o procedimento e o dia sem login; o pedido cai numa fila de triagem e vira agendamento em um clique |
| **Perfis de acesso interno** | Atendente (esteira, cadastros, triagem) e Responsável (também financeiro e gestão de acesso) — a divisão que a equipe pediu ao crescer |
| **Pesquisa de NPS** | A cada 60 dias, para a clínica que NÃO teve múltiplos atendimentos no período — nota de 0 a 10 e três perguntas abertas |

### Os três níveis de acesso

| Nível | Caminho | Enxerga |
| --- | --- | --- |
| Equipe Hemoderi | `/painel` | a operação inteira: esteira, agenda, cadastros, financeiro e acessos |
| Clínica contratante | `/portal` | os próprios pedidos e o valor cobrado — nunca o repasse do profissional |
| Profissional | `/profissional` | a própria agenda, a própria disponibilidade e os próprios ganhos |

O escopo **sempre** vem da conta autenticada, nunca de um id no formulário ou
na URL. É o que impede uma clínica ler os pedidos de outra trocando um
parâmetro.

Dentro de `/painel`, a equipe Hemoderi ainda se divide em dois perfis
(`PerfilInterno`), decisão da reunião de 14/09 depois de ver a equipe
crescer:

| Perfil | Enxerga |
| --- | --- |
| Atendente | esteira, agenda, cadastros e triagem — o dia a dia |
| Responsável | tudo isso, mais o repasse devido a cada profissional e a gestão de acesso (`/painel/financeiro`, `/painel/acessos`) |

O perfil é escolhido na criação do acesso e pode ser alterado depois, direto
na linha da tabela em `/painel/acessos` — sempre por um Responsável, nunca
pela própria pessoa (a mesma trava de auto-suspensão vale aqui: ninguém se
rebaixa, e a equipe nunca fica sem pelo menos um Responsável ativo). Uma
conta interna criada **antes** deste campo existir continua com acesso
total — é tratada como Responsável mesmo sem o campo preenchido
(`perfilEfetivo` em `src/lib/papeis.ts`), para o campo novo não trancar
ninguém que já trabalhava no sistema.

### Como um acesso nasce, é redefinido e é suspenso

Não existe autocadastro nem senha escolhida pela equipe. O ciclo é:

1. **Criar.** Em `/painel/acessos`, ou em um clique na própria lista de
   clínicas e de profissionais (*Gerar acesso*, que aproveita nome e e-mail do
   cadastro). O sistema sorteia uma senha em grupos ditáveis — `7KF3-QM9T-XR4P`,
   sem I/O/0/1, que é o que evita a ligação de volta perguntando "é i ou um?".
2. **Repassar.** A senha aparece **uma vez** na tela de quem a gerou, com um
   botão que copia a mensagem pronta para o WhatsApp. Ela não aparece de novo:
   o banco guarda só o hash.
3. **Primeira entrada.** A senha nasce marcada como provisória. Enquanto for,
   as três guardas de `src/lib/sessao.ts` param a pessoa em `/trocar-senha` —
   não dá para chegar em nenhuma tela do sistema sem escolher a própria senha.
   A partir daí ninguém da operação conhece a senha de ninguém, o que importa
   num sistema que decide repasse.
4. **Redefinir.** *Redefinir senha* sorteia outra e volta ao passo 2. A senha
   anterior para de valer no mesmo instante.
5. **Suspender.** *Suspender* desliga o login sem apagar nada: o cadastro, os
   pedidos e o histórico continuam. Como as guardas reconferem o banco a cada
   request, a suspensão vale na hora — inclusive para quem está com uma aba
   aberta neste segundo, e não só quando o token expirar.

Tudo isso vira registro em `RegistroAuditoria`: "quem devolveu o acesso do
fulano em março" tem resposta.

### O atendimento na agenda do Google do profissional

O destino do evento é a agenda **do profissional**, não uma agenda da
operação: o ponto é ele abrir o celular e o compromisso estar lá, com o
lembrete dele. Cada um conecta a sua em *Disponibilidade → Minha agenda do
Google*, depois de compartilhar a agenda com a conta de serviço da Hemoderi
dando "Fazer alterações nos eventos". Quem não conectou cai em
`GOOGLE_AGENDA_ID`, a agenda da operação, se houver uma — e sem nenhuma das
duas a integração apenas não publica; nada quebra.

O ciclo é completo, e é por isso que o pedido guarda **duas** referências
(`googleEventoId` e `googleAgendaId`):

| No sistema | Na agenda do Google |
| --- | --- |
| Confirmado / alocado | evento criado |
| Remarcado | o **mesmo** evento muda de horário |
| Trocou de profissional | apaga da agenda de quem saiu, cria na de quem entrou |
| Cancelado, ou profissional removido | evento apagado |

Um id de evento só é endereçável junto com o id da agenda que o contém: sem
guardar as duas coisas, trocar o profissional deixaria o compromisso na agenda
do antigo para sempre.

A sincronização **nunca derruba a operação**. O atendimento existe no banco; o
evento é uma projeção dele. Se o Google recusar (causa mais comum: a agenda
deixou de estar compartilhada), a falha vira registro em `SincronizacaoExterna`
e o painel do dia avisa — uma integração que falha calada é pior que integração
nenhuma, porque a equipe continua confiando na agenda do celular.

### O pedido de quem ainda não é cliente

A porta da rua do sistema é `/agendar`, sem login. A ordem é **escolher
primeiro, identificar depois**: procedimento, dia e horário, e só no terceiro
passo o telefone. Na ordem inversa a pessoa desiste antes de ver o que existe
— o esforço já investido nos dois primeiros passos é o que faz valer a pena
preencher o cadastro.

O catálogo aparece agrupado por **família** (`src/lib/familia.ts`) — "PRF",
"Piezo", "Laser" —, que é como o comercial fala, e não pela categoria interna.
A família é campo do serviço; vazia, o sistema deduz do nome, e famílias de um
item só se juntam em "Outros" para a vitrine não virar uma lista de rótulos
com um item cada.

O horário escolhido é **preferência, não reserva**, e a tela diz isso com
todas as letras: sem saber de qual clínica é o pedido, o sistema não tem como
conferir sala nem equipamento, e prometer horário seria prometer o que a
operação ainda não sabe se cumpre.

O pedido nasce em `SolicitacaoPublica` e espera em `/painel/solicitacoes`. A
equipe vincula a uma clínica — existente, sugerida pelo telefone, ou nova — e
ele vira `Pedido` na esteira normal. Nada entra na agenda sem passar por
alguém: é o contrário de um formulário público que grava direto no banco de
produção. Contra enxurrada, o envio é limitado por telefone e no total dentro
de uma janela de uma hora.

### A avaliação do atendimento

Quem avalia é a **clínica contratante**, não o paciente: é ela que contrata a
Hemoderi, e é a percepção dela que decide se o contrato continua. A nota só
existe depois de `REALIZADO` — nota antes do atendimento é palpite.

No portal da clínica, o atendimento realizado sem nota vira uma fila curta
("Como foi o atendimento?", os cinco mais recentes) e o histórico guarda o que
já foi respondido. A clínica pode corrigir a própria nota: errar a estrela no
celular é comum demais para virar registro permanente, e `atualizadaEm`
mantém a correção visível em vez de silenciosa.

Do lado da equipe, a nota entra onde a decisão acontece: a média por
profissional na lista de profissionais e na produtividade do mês — com ~60
prestadores, é o que separa quem a clínica quer de volta de quem ela evita — e
os comentários recentes no painel do dia, que é o que a operação lê e age em
cima. O comentário é opcional de propósito: exigir texto derruba a taxa de
resposta, e uma nota sem comentário ainda é informação.

### A pesquisa de NPS, de 60 em 60 dias

Diferente da estrela por atendimento, esta pergunta é rara e mira o oposto de
um NPS comum: só entra a clínica que **não** teve múltiplos atendimentos na
janela de 60 dias (`src/lib/nps.ts`). O volume de uso de quem atende toda
semana já é satisfação declarada; quem está esfriando é quem tem alguma coisa
a dizer que a taxa de uso ainda não denunciou sozinha.

A janela é calculada, nunca guardada como "próxima data": cada clínica tem
períodos de 60 dias consecutivos contados a partir do próprio cadastro, e a
rotina (`src/lib/rotinas/nps.ts`, chamada pela mesma rotina diária de
lembretes) só cria a pesquisa quando a janela mais recente ainda não foi
avaliada — idempotente por construção, não por trava. A escala é a clássica
de 0 a 10 (promotor/neutro/detrator), com três perguntas abertas: o que
funcionou bem, que expectativa não foi atendida, e o que poderia melhorar. A
clínica responde uma vez só, no portal; a equipe vê nota, classificação e os
três textos na tela de detalhe da clínica.

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
| Equipe (Responsável) | `equipe@hemoderi.com.br` |
| Equipe (Atendente) | `atendente@hemoderi.com.br` |
| Clínica | `clinica-santa-rita@exemplo.com.br` |
| Profissional | `ana@exemplo.com.br` |

O catálogo semeado já são os 34 itens reais do catálogo comercial 2026 da
Hemoderi (nome, categoria e preço de tabela); duração e inventário de
equipamento ainda têm estimativa — ver `docs/fase-0-insumos.md` para o que
falta confirmar antes do go-live. Todo campo do serviço é editável direto na
tela **Serviços e equipamentos**.

Em produção, o primeiro acesso interno é criado pela linha de comando — quem
cria um usuário interno enxerga a operação inteira, e essa porta não se abre
pela internet:

```bash
npm run db:usuario -- --email=voce@hemoderi.com.br --nome="Seu Nome" --senha='...' --papel=INTERNO
```

Esta é a única via em que a senha é escolhida à mão, e de propósito: é a saída
de emergência para destravar a equipe quando ninguém consegue entrar pelo
painel. Do painel para dentro, toda senha nasce sorteada e provisória.

### Verificação

```bash
npm test        # regras puras: agenda, repasse, dinheiro, esteira
npm run typecheck
npm run build
npm run fumaca          # ciclo completo no navegador (precisa da app rodando + seed)
npm run fumaca:acessos  # ciclo de uma credencial: criar, trocar, redefinir, suspender
npm run fumaca:avaliacao # a clínica avalia, corrige, e a equipe enxerga
npm run fumaca:agenda   # ciclo do evento no Google, com o Google substituído por um duplo
npm run fumaca:ata      # as decisões da reunião de 14/09, tela por tela
npm run fumaca:publico  # a vitrine sem login e a triagem do pedido que chega dela
npm run fumaca:nps      # a pesquisa de NPS de 60 em 60 dias, ponta a ponta
```

Os testes unitários cobrem o que é fácil de quebrar sem perceber: sobreposição
de horários, emenda de janelas de disponibilidade, a cadeia de repasse e as
transições permitidas da esteira.

O `npm run fumaca` cobre o que eles não alcançam: percorre no navegador o
caminho que o dinheiro faz — a clínica agenda pelo portal, remarca, a equipe
confirma e aloca, o atendimento é fechado e o repasse nasce no financeiro.
É para ambiente de teste, nunca contra a base de produção: ele cria e fecha um
atendimento de verdade.

## Onde fica o quê

```
prisma/schema.prisma        modelo do domínio, com o porquê de cada decisão
src/lib/agenda.ts           aritmética de agenda, sem banco — é o que os testes cobrem
src/lib/alocacao.ts         as quatro travas juntas, consultando o banco
src/lib/repasse.ts          a cadeia de regras de repasse
src/lib/pedido.ts           a máquina de status da esteira
src/lib/sessao.ts           as guardas dos três níveis de acesso (e do perfil Atendente/Responsável)
src/lib/papeis.ts           rótulos e o perfil efetivo (NULL vira Responsável)
src/lib/senha.ts            sorteio da senha provisória e regras da senha escolhida
src/app/actions/acessos.ts  criar, redefinir, suspender, trocar a própria senha e o perfil interno
scripts/fumaca.mjs          teste de fumaça do ciclo completo, no navegador
scripts/fumaca-acessos.mjs  teste de fumaça da gestão de acesso, no navegador
scripts/fumaca-avaliacao.mjs teste de fumaça da avaliação pela clínica
scripts/fumaca-ata.mjs      teste de fumaça das decisões da reunião de 14/09
scripts/fumaca-publico.mjs  teste de fumaça do agendamento público e da triagem
scripts/fumaca-nps.mjs      teste de fumaça da pesquisa de NPS de 60 em 60 dias
src/lib/avaliacao.ts        escala de 1 a 5, média e formatação
src/lib/nps.ts              regras puras do NPS: elegibilidade, faixa e score
src/lib/rotinas/nps.ts      geração da pesquisa a cada 60 dias, consultando o banco
src/components/CampoDocumento.tsx  CPF/CNPJ com dígito verificador e, só CNPJ, consulta na Receita
src/lib/familia.ts          agrupamento comercial do catálogo, usado na vitrine
src/app/actions/publico.ts  o pedido de quem ainda não tem cadastro, e a triagem
src/app/agendar/            vitrine pública: escolher primeiro, identificar depois
src/lib/integracoes/google-evento.ts  a decisão da sincronização, sem banco nem rede
src/lib/integracoes/google-api.ts     o único ponto que fala com o Google
src/app/painel/             equipe Hemoderi
src/app/portal/             clínica contratante
src/app/profissional/       prestador
src/lib/integracoes/        PipeDrive, Google Agenda e WhatsApp
```

## Estado e próximos passos

O núcleo operacional e os dois portais estão de pé; as integrações externas
estão desenhadas e desligadas até a Fase 4 — sem as variáveis de ambiente elas
registram a intenção em `SincronizacaoExterna` em vez de fingir sucesso.

Para publicar, siga [`docs/deploy.md`](docs/deploy.md) — Neon e Vercel, com o
`/api/saude` para conferir em um comando se o deploy está de pé de verdade.

O cronograma por fase está em [`docs/roadmap.md`](docs/roadmap.md), e o que
precisa vir da Hemoderi para destravar a Fase 0 está em
[`docs/fase-0-insumos.md`](docs/fase-0-insumos.md).
