/**
 * O tutorial do sistema (ata de 03/11: "um tutorial ou galeria dentro do
 * sistema que explique a função de cada botão, para ele ser autodidata").
 * Uma lista por área; cada tela tem o que ela faz e o que cada botão faz.
 * Texto curto, na língua de quem usa — quando uma tela mudar, mude aqui.
 */

export type TopicoDeAjuda = { tela: string; para: string; botoes: { nome: string; faz: string }[]; dica?: string };

export const AJUDA_EQUIPE: TopicoDeAjuda[] = [
  {
    tela: "Hoje",
    para: "O resumo do dia: quantos estão em cada fila (cada número leva à fila), a agenda do dia em ordem de horário, com chegada e relatório de cada atendimento.",
    botoes: [
      { nome: "Números coloridos no topo", faz: "Abrem a fila correspondente na esteira (para confirmar, para alocar, para conferir…)." },
      { nome: "Avisar clínica", faz: "Aparece quando o profissional está atrasado: manda o aviso de atraso à clínica pela central do WhatsApp." },
      { nome: "Reenviar aviso", faz: "Na lista \"Aguardando aceite\": manda de novo ao profissional o aviso da alocação." },
    ],
  },
  {
    tela: "Agendamentos (esteira)",
    para: "A linha de produção dos agendamentos: cada aba é uma etapa (Para confirmar → Para alocar → Alocados → Para conferir → Fechados). A esteira abre na fila do seu setor.",
    botoes: [
      { nome: "Buscar", faz: "Procura por código (\"2026-0051\" ou só \"51\"), clínica, doutor, paciente, profissional ou serviço." },
      { nome: "Filtros", faz: "Período (hoje, amanhã, 7 dias, já passaram ou datas), profissional (inclusive \"sem profissional\"), equipamento e condição de pagamento. Os números das abas seguem os filtros." },
      { nome: "Ver em: Cartões | Tabela", faz: "A tabela mostra uma linha por serviço e ordena ao clicar no título da coluna (data, clínica, equipamento, profissional, status, valor)." },
      { nome: "Confirmar", faz: "Aceita a solicitação da clínica: o agendamento vira compromisso e vai para \"Para alocar\"." },
      { nome: "Alocar profissional… / Alocar", faz: "Escolhe quem atende. A lista só traz quem está habilitado no serviço e livre no horário. A ajuda de custo é informada aqui." },
      { nome: "Desalocar", faz: "Tira o profissional do caso (com motivo). Ele recebe automaticamente um aviso pelo WhatsApp." },
      { nome: "Reagendar / Cancelar", faz: "Muda data e horário ou cancela, sempre com motivo. O profissional alocado é avisado automaticamente." },
      { nome: "✏️ Editar agendamento", faz: "Aparece ao passar o mouse no cartão: muda serviço, local, doutor, paciente e demais dados." },
      { nome: "Enviar confirmação curta / Enviar resumo detalhado", faz: "Mandam à clínica, pela central do WhatsApp, a confirmação curta ou o resumo completo do agendamento." },
      { nome: "Enviar aviso ao profissional", faz: "Manda de novo ao profissional o aviso da alocação." },
      { nome: "Marcar realizado / Registrar falta", faz: "Fecham o atendimento quando a equipe já sabe o resultado." },
      { nome: "Cobrar relatório pelo WhatsApp", faz: "Aparece quando o atendimento passou e o relatório não veio." },
      { nome: "Conferir antes de liberar o repasse", faz: "Pós-venda: marque serviço, valor e ajuda de custo e clique em \"Aprovar e liberar repasse\". Na aprovação o atendimento vira negócio GANHO no PipeDrive, com o relatório. \"Recusar e devolver\" volta o relatório ao profissional com o motivo." },
      { nome: "Condição de pagamento", faz: "Classificação interna (antecipado, no ato, faturado, cortesia). Já vem da condição cadastrada na clínica; o Pix pago antes do atendimento marca \"Antecipado\"." },
    ],
    dica: "Se um botão não responder logo depois de uma atualização do sistema, recarregue a página (Ctrl+F5).",
  },
  {
    tela: "Agenda",
    para: "Os atendimentos por dia (linha do tempo, como no Google Agenda), por profissional, em lista de 7 dias ou no calendário do mês.",
    botoes: [
      { nome: "Dia / Lista / Calendário do mês", faz: "Trocam a forma de ver." },
      { nome: "Ver por profissional", faz: "No dia, agrupa por profissional, com a disponibilidade declarada de cada um." },
    ],
  },
  {
    tela: "Disponibilidade",
    para: "Quem declarou disponibilidade em cada dia e horário, para cruzar com a agenda antes de alocar.",
    botoes: [],
  },
  {
    tela: "Clínicas",
    para: "Cadastro das clínicas: dados, endereços, perfil e tabelas de preço, condição de pagamento e responsável financeiro.",
    botoes: [
      { nome: "Condição de pagamento", faz: "Preencha: é ela que já vem marcada em todo agendamento novo da clínica." },
      { nome: "Conta de teste", faz: "Só o responsável vê: a clínica recebe o WhatsApp automático mesmo com o envio aos clientes pausado." },
    ],
  },
  {
    tela: "Profissionais",
    para: "Cadastro, serviços em que cada um está habilitado (é isso que decide quem aparece para alocar), repasse e atrasos.",
    botoes: [],
  },
  {
    tela: "Serviços e equipamentos",
    para: "Catálogo de serviços, preços por região e por tabela, e o estoque de equipamentos.",
    botoes: [],
  },
  {
    tela: "Financeiro",
    para: "Faturas, cobranças Pix, repasses por praça e atendimentos do mês.",
    botoes: [{ nome: "Repasses por praça", faz: "Importa a planilha de repasses: \"Conferir\" mostra o que muda, \"Aplicar\" grava." }],
  },
];

export const AJUDA_CLINICA: TopicoDeAjuda[] = [
  {
    tela: "Catálogo",
    para: "Os serviços e valores. Escolha primeiro o local do atendimento: os preços mudam de região para região.",
    botoes: [
      { nome: "+ Agendar atendimento", faz: "Abre o agendamento já com o local escolhido." },
      { nome: "Clique aqui e conheça os pacotes", faz: "Abre o equipamento com os pacotes, o valor de cada um e o valor por paciente ou por disparo." },
      { nome: "+ Usar outro endereço", faz: "Cadastra outro local ali mesmo — dá para digitar o endereço à mão, sem o CEP." },
    ],
  },
  {
    tela: "Agendar atendimento",
    para: "Quatro passos: 1) equipamento e serviços, 2) endereço, 3) data e horário, 4) informações do atendimento.",
    botoes: [
      { nome: "Endereço", faz: "Toque no endereço para selecionar (aparece ✓ Selecionado) ou cadastre outro." },
      { nome: "Horário", faz: "Digite (\"1430\" vira 14:30) ou toque no relógio 🕒." },
      { nome: "Solicitar agendamento", faz: "Envia para a central confirmar. Você acompanha em Meus agendamentos." },
    ],
  },
  {
    tela: "Meus agendamentos",
    para: "Os próximos atendimentos, com status, pagamento e ações.",
    botoes: [
      { nome: "Ver resumo", faz: "Todos os dados do agendamento — e o Pix ou o cartão para pagar." },
      { nome: "Reagendar / Cancelar", faz: "Mudam ou cancelam o atendimento, dentro dos prazos." },
      { nome: "+ Adicionar à sua agenda", faz: "Salva o horário no Google Agenda ou no calendário do celular." },
      { nome: "Recibo", faz: "Aparece depois do pagamento: abre o recibo para imprimir ou salvar em PDF." },
    ],
  },
  {
    tela: "Histórico e pagamentos",
    para: "O que já aconteceu e o que falta pagar. As pendências aparecem no topo.",
    botoes: [
      { nome: "Pagar selecionados com um Pix", faz: "Marque os atendimentos e pague todos num Pix só." },
      { nome: "Pagar com cartão", faz: "Crédito à vista ou em até 12x (o total de cada opção aparece antes de escolher)." },
      { nome: "Recibo do atendimento / Recibo da fatura", faz: "Emitem o recibo depois do pagamento." },
    ],
  },
  { tela: "Avaliações", para: "Dê nota aos atendimentos: ela ajuda a escolher quem volta à sua clínica.", botoes: [] },
  { tela: "Meus endereços", para: "Os locais onde a sua clínica atende — o principal e os adicionais.", botoes: [] },
];

export const AJUDA_PROFISSIONAL: TopicoDeAjuda[] = [
  {
    tela: "Minha agenda",
    para: "Seus atendimentos. O local e a clínica aparecem 24 horas antes (fora de São Paulo, já na alocação).",
    botoes: [
      { nome: "Aceitar / Recusar", faz: "Responda cada alocação. Depois de aceitar, só a logística tira você do caso." },
      { nome: "Cheguei", faz: "Registre ao chegar: guarda horário e localização. 15 minutos depois do horário sem registro, chega um lembrete no WhatsApp." },
      { nome: "Preencher relatório", faz: "Depois do atendimento: serviço feito, horários, sinais vitais, recebimento, nome do paciente e anexos." },
    ],
    dica: "Mudou ou cancelou um atendimento seu? Você recebe um aviso no WhatsApp — confira a agenda.",
  },
  { tela: "Disponibilidade", para: "Os dias e horários em que você pode atender.", botoes: [] },
  { tela: "Relatórios", para: "Os relatórios enviados e a situação de cada um (em conferência, aprovado, devolvido).", botoes: [] },
  { tela: "Meus ganhos", para: "Os repasses de cada atendimento — liberados depois da aprovação do relatório.", botoes: [] },
  { tela: "Meus dados", para: "Contato, registro no conselho, chave Pix e a agenda do Google para receber seus atendimentos.", botoes: [] },
];
