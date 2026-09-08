# Fase 0 — insumos da Hemoderi

Lista do que precisa vir da Hemoderi para a Fase 0 fechar, conforme a Cláusula
12 da proposta. Cada item diz **onde ele entra no sistema**, para que a
conversa seja sobre o dado e não sobre o formulário.

Enquanto os insumos não chegam, o sistema roda com dados de exemplo
(`npm run db:seed`) — que não são os da operação e não devem ser usados como
referência de valor ou de regra.

## 1. Tabela de serviços

Para cada serviço prestado hoje:

| Informação | Onde entra |
| --- | --- |
| Nome do serviço | `Servico.nome` |
| Duração cheia, incluindo preparo | `Servico.duracaoMin` |
| Valor cobrado da clínica (tabela) | `Servico.valorPadraoCentavos` |
| Exige equipamento da Hemoderi? | `Servico.exigeEquipamento` |

A **duração cheia** importa mais do que parece: é ela que define o bloco na
agenda e o cálculo de conflito. Duração subestimada gera dois atendimentos que
o sistema considera possíveis e a operação não cumpre.

## 2. Preço negociado por clínica

Quando uma clínica paga diferente da tabela, uma linha por par clínica ×
serviço → `PrecoClinica`. Sem linha, vale a tabela.

## 3. Regras de repasse

A cadeia tem quatro degraus (`src/lib/repasse.ts`). Precisamos saber quais
existem na prática:

1. **Acerto específico** de um profissional em um serviço → `RegraRepasse`
2. **Regra do serviço** — procedimento em que a Hemoderi banca o insumo e
   repassa menos → `Servico.repassePercent` ou `repasseFixoCentavos`
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
