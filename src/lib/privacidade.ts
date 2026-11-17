/**
 * A política de privacidade pública (exigida pela Apple e pelo Google para os
 * apps). Ficou aqui, como dado, para a página e as lojas apontarem para o mesmo
 * texto. ESTE TEXTO É UMA MINUTA: antes de ir às lojas, passa pela revisão do
 * advogado da Hemoderi.
 */
export const VERSAO_DA_POLITICA = "17 de novembro de 2026";

/** Contato do responsável pelos dados. Confirmar com a Hemoderi. */
export const CONTATO_DE_PRIVACIDADE = "andre@hemoderi.com.br";

export const SECOES_DA_POLITICA: { titulo: string; paragrafos?: string[]; itens?: string[] }[] = [
  {
    titulo: "1. Quem somos",
    paragrafos: [
      "A Hemoderi (CNPJ 35.272.539/0001-89) é a controladora dos dados tratados no aplicativo e no sistema Dilon Saúde | Operações, que organiza agendamentos, alocação de profissionais, relatórios de atendimento, cobranças e repasses. A Dilon Tech (CNPJ 64.601.665/0001-33) desenvolve e mantém o sistema e atua como operadora, tratando os dados em nome da Hemoderi, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
    ],
  },
  {
    titulo: "2. Quais dados tratamos",
    itens: [
      "Cadastro e acesso: nome, e-mail, telefone, senha (guardada de forma criptografada) e vínculo com a clínica ou o profissional.",
      "Clínicas: razão social, CNPJ ou CPF, endereços de atendimento, contatos, doutores responsáveis e dados de cobrança.",
      "Profissionais: nome, CPF, telefone, e-mail, registro no conselho, chave Pix, disponibilidade e, se conectada por você, a agenda do Google.",
      "Atendimentos: serviço, data, horário, local, nome do paciente, procedimento realizado e observações do relatório. Podem conter informações de saúde, que tratamos com cuidado reforçado e apenas para executar e registrar o atendimento.",
      "Localização: só no app do profissional, no momento em que ele toca em “Cheguei”, para registrar a chegada ao atendimento.",
      "Câmera e arquivos: fotos e documentos que você escolhe anexar ao atendimento ou ao relatório.",
      "Aparelho: o identificador usado para enviar notificações do app, e dados técnicos básicos de acesso (como data e hora e tipo de aparelho).",
      "Pagamentos: valores, forma de pagamento e situação da cobrança. Os dados do cartão são digitados na página segura do Asaas e não passam pelos nossos servidores.",
    ],
  },
  {
    titulo: "3. Para que usamos",
    itens: [
      "Executar o contrato: agendar, confirmar, alocar e registrar atendimentos, emitir cobranças e pagar os repasses.",
      "Avisar sobre o que importa: confirmações, alocações, lembretes e mudanças, por notificação no app e por WhatsApp.",
      "Cumprir obrigações legais e regulatórias, como as fiscais e as de guarda de registros de saúde.",
      "Proteger o sistema: prevenir fraudes, manter a segurança e corrigir falhas.",
      "Melhorar o serviço, com estatísticas que não identificam pessoas.",
    ],
    paragrafos: ["Não vendemos dados pessoais e não os usamos para publicidade de terceiros."],
  },
  {
    titulo: "4. Com quem compartilhamos",
    paragrafos: ["Compartilhamos apenas o necessário, com prestadores que nos ajudam a operar o serviço:"],
    itens: [
      "Hospedagem e banco de dados: Vercel e Neon.",
      "Notificações do app: Google Firebase Cloud Messaging e, no iPhone, a Apple.",
      "Pagamentos: Asaas (cartão) e Bradesco (Pix).",
      "Relacionamento comercial: Pipedrive.",
      "Agenda: Google Agenda.",
      "Mensagens: central de WhatsApp (Dilon Zap).",
      "Autoridades públicas, quando a lei exigir.",
    ],
  },
  {
    titulo: "5. Por quanto tempo guardamos",
    paragrafos: [
      "Mantemos os dados enquanto a conta existir e pelo prazo necessário para cumprir obrigações legais e regulatórias, como as fiscais, as de saúde e as de defesa em processos. Depois disso, os dados são apagados ou anonimizados.",
    ],
  },
  {
    titulo: "6. Seus direitos",
    paragrafos: [
      "Você pode, a qualquer momento, confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a anonimização, a portabilidade ou a eliminação do que não for necessário, saber com quem compartilhamos e revogar consentimentos. Para exercer qualquer direito, escreva para o contato abaixo.",
    ],
  },
  {
    titulo: "7. Como excluir a sua conta",
    paragrafos: [
      "Dentro do app, vá em Configurações (clínica) ou Meus dados (profissional) e use “Excluir minha conta”. O acesso é encerrado e o seu nome, e-mail e telefone são apagados. O histórico de atendimentos, relatórios, repasses e cobranças é mantido pelo prazo que a lei exige, sem ligação com a sua conta. Se não conseguir acessar o app, veja /exclusao-de-conta ou escreva para o contato abaixo.",
    ],
  },
  {
    titulo: "8. Segurança",
    paragrafos: [
      "Usamos conexão criptografada, senhas protegidas, controle de acesso por perfil e registro das ações. Nenhum sistema é totalmente imune a riscos; em caso de incidente que possa afetar você, avisaremos a Hemoderi e as pessoas envolvidas, nos prazos da lei.",
    ],
  },
  {
    titulo: "9. Crianças",
    paragrafos: ["O app é destinado a clínicas e profissionais de saúde e não é voltado a menores de 18 anos."],
  },
  {
    titulo: "10. Mudanças nesta política",
    paragrafos: ["Podemos atualizar esta política. A data da versão vigente aparece no topo desta página, e mudanças relevantes serão comunicadas no app."],
  },
];
