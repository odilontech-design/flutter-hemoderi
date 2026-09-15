# Fase 0 — insumos da Hemoderi

Lista do que precisa vir da Hemoderi para a Fase 0 fechar, conforme a Cláusula
12 da proposta. Cada item diz **onde ele entra no sistema**, para que a
conversa seja sobre o dado e não sobre o formulário.

Enquanto os insumos não chegam, o sistema roda com dados de exemplo
(`npm run db:seed`) — que não são os da operação e não devem ser usados como
referência de valor ou de regra.

## 1. Tabela de serviços

Os 34 itens do catálogo comercial 2026 (CAT_LOGO_HEMODERI_2026.pdf, seção
"Investimento") já estão cadastrados — nome, categoria e **preço de tabela**
vêm de lá. Cada linha de "Investimento" virou um serviço próprio, incluindo
os pacotes por volume (GBT, Megaderme, Platinum, Ultrassom) e as diárias
(Motor de Implante, Bisturi Elétrico) — são produtos comerciais distintos,
com preço próprio, não variações de um único item. **Dois campos ainda
ficaram com estimativa e precisam de confirmação da equipe antes do
go-live real:**

| Informação | Onde entra | Estado |
| --- | --- | --- |
| Nome do serviço | `Servico.nome` | ✅ do catálogo 2026 |
| Valor de tabela (Grande São Paulo) | `Servico.valorPadraoCentavos` | ✅ do catálogo 2026 — ver item 2 para preço por clínica |
| Categoria (Odontologia/Estética/Saúde) | `Servico.categoria` | ⚠️ nossa leitura do catálogo — alguns itens cruzam especialidade (PRF, Sedação Consciente) e merecem revisão |
| Duração cheia, incluindo preparo | `Servico.duracaoMin` | ⚠️ onde o catálogo declara o período contratado ("4 horas", "até 3h de funcionamento"), veio de lá; sem essa informação, é estimativa por tipo de procedimento |
| Exige equipamento da Hemoderi? | `Servico.exigeEquipamento` + `Servico.tipoEquipamento` | ⚠️ presumido pelo tipo de item (ex.: fotografia e sedação marcados como "não exige", por serem mais sobre o profissional que sobre o aparelho) |

Um combo do catálogo ficou de fora de propósito: "Stickybone + Membranas +
Piezosurgery + Sedação" (R$1.690,00) reserva dois equipamentos ao mesmo
tempo (Piezo e Rotamix), e o sistema hoje só trava um tipo de equipamento
por serviço — falta modelar equipamento múltiplo por serviço antes de
oferecê-lo como reserva automática (ver `src/lib/inicializar.ts`).

Sedação Consciente também tem tarifa de Interior (R$1.050,00) além da de
Grande São Paulo (R$850,00, cadastrada como valor de tabela): o sistema não
modela preço por praça, só por clínica (item 2) — se isso importar na
prática, cada clínica de fora da Grande SP precisa do preço negociado
correspondente.

A **duração cheia** importa mais do que parece: é ela que define o bloco na
agenda e o cálculo de conflito. Duração subestimada gera dois atendimentos que
o sistema considera possíveis e a operação não cumpre. A lista completa está
em `src/lib/inicializar.ts`, com o comentário de cada estimativa — é mais
rápido revisar ali linha a linha do que recadastrar do zero. Qualquer ajuste
pode ser feito direto na tela **Serviços e equipamentos** (todo campo é
editável ali, inclusive depois do go-live).

**`tipoEquipamento`** é o que a alocação usa para reservar o aparelho
certo — um AirFlow não substitui um laser LiteTouch. Ele precisa casar
exatamente com o campo `tipo` do equipamento cadastrado (tela **Serviços e
equipamentos**). Cinco dos trinta e quatro serviços (as variações de PRF)
compartilham o tipo "Centrífuga PRF": confirmar quantas centrífugas a
operação tem de verdade — o seed chutou 2, e é esse número que decide
quantos atendimentos de PRF cabem ao mesmo tempo.

## 2. Preço negociado por clínica

Quando uma clínica paga diferente da tabela, uma linha por par clínica ×
serviço → `PrecoClinica`. Sem linha, vale a tabela.

## 3. Regras de repasse

A cadeia tem quatro degraus (`src/lib/repasse.ts`). Precisamos saber quais
existem na prática:

1. **Acerto específico** de um profissional em um serviço → `RegraRepasse`
2. **Regra do serviço** — procedimento em que a Hemoderi banca o insumo e
   repassa menos → `Servico.repasseFixoCentavos` (sempre valor fixo, nunca
   percentual — decisão da reunião de 14/09; a tela só oferece esse campo)
3. **Percentual do profissional** → `Profissional.repassePercentPadrao`
4. **Padrão da operação** → `Parametros.repassePercentPadrao`

Também precisamos da decisão sobre **falta**: hoje o sistema registra a falta
e não gera repasse automático. Se a operação paga deslocamento quando o
paciente não comparece, isso precisa de regra própria — e é melhor decidir
antes do primeiro mês do que na primeira discussão.

## 4. Clínicas contratantes

| Informação | Onde entra |
| --- | --- |
| Nome, CNPJ, endereço e contato | `Clinica` |
| **Quantos atendimentos cabem ao mesmo tempo** no endereço | `Clinica.salas` |
| Telefone que recebe confirmação e lembrete | `Clinica.telefone` |

O número de salas é o que permite alocar dois profissionais no mesmo horário
no mesmo endereço sem que isso seja conflito. Na dúvida entre 1 e o número
real, o número real: errar para menos trava agendamento legítimo.

## 5. Profissionais

Relação dos profissionais cadastrados com nome, CPF, telefone, e-mail,
conselho e registro, especialidade e chave PIX → `Profissional`.

Precisamos também definir **quem declara a disponibilidade inicial**: o
profissional, no portal dele, ou a equipe, a partir do que já se sabe hoje.
Sem disponibilidade declarada, o profissional não aparece para alocação.

## 6. Equipamentos

Relação dos aparelhos com nome, tipo e número de patrimônio →
`Equipamento`. Aparelho em manutenção fica com status próprio e sai da conta
da alocação automaticamente.

## 7. Mensagens de WhatsApp

Os modelos usados hoje para confirmação, lembrete e status (realizado/faltou).
Entram em `src/lib/integracoes/whatsapp.ts`, no lugar dos textos-esqueleto.
Vale mandar o texto exato, com a pontuação e o tom que a equipe já usa — é o
que a clínica reconhece.

## 8. PipeDrive

Telas e estrutura dos funis, e a definição de **em que momento exato** o
negócio é marcado como ganho. Hoje o sistema marca quando o atendimento é
realizado; se a regra comercial for outra, ela muda em um lugar só.

## 9. Google Agenda

Autorização de acesso à agenda da equipe (conta de serviço) e a definição de
**qual agenda** recebe os eventos.

## 10. Parâmetros da operação

| Parâmetro | Padrão atual |
| --- | --- |
| Horário de funcionamento | 07:00 às 19:00 |
| Antecedência mínima para a clínica agendar sozinha | 24 horas |
| Antecedência do lembrete | 24 horas |
| Repasse padrão | 60% |
| Prazo de vencimento da fatura | 10 dias após o fechamento |

Todos são editáveis em `Parametros`, sem deploy.

## 11. Responsável pela validação

A Cláusula 12 pede a indicação de uma pessoa responsável por validar cada
entrega. É o item mais barato da lista e o que mais atrasa cronograma quando
fica em aberto.
