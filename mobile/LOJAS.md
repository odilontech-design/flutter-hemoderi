# Publicação nas lojas — roteiro simplificado

Dois apps: **Hemoderi** (clínica, `br.com.hemoderi.clinica`) e **Hemoderi
Profissional** (`br.com.hemoderi.profissional`). Tudo que é tela e regra vem do
sistema; o app só acrescenta push, biometria, câmera e (no profissional)
localização. Este roteiro separa o que **já está pronto**, o que **depende de
conta** e o que **é só preencher**.

## 1. Já pronto no repositório

| Item | Onde |
| --- | --- |
| Ícones e abertura (splash) dos dois apps | `mobile/<app>/assets` (gerados por `mobile/scripts/gerar-icones.js`) |
| Ícone 512 px e imagem de destaque 1024 × 500 (Google Play) | `mobile/<app>/loja` (`mobile/scripts/gerar-imagens-loja.js`) |
| Permissões por app (localização só no Profissional) e textos de permissão do iOS | `mobile/scripts/preparar-nativo.sh` |
| Versão para a loja (nome no `package.json`, número = execução do CI) | idem |
| APK de teste | workflow **App Android (teste)** |
| Chave de envio do Android | workflow **App Android — gerar chave de envio** |
| Arquivo da loja do Android (.aab assinado) | workflow **App Android — versão para a loja (AAB)** |
| Envio do iPhone para o TestFlight | workflow **App iOS — enviar para o TestFlight** |
| Política de privacidade (URL pública) | https://app.hemoderi.com.br/privacidade |
| Exclusão de conta (no app e em URL pública) | https://app.hemoderi.com.br/exclusao-de-conta |

## 2. Ordem dos passos

### Google Play (Android)
1. **Conta de desenvolvedor da Hemoderi** como *organização* (com o D-U-N-S), em
   play.google.com/console — taxa única de US$ 25. Conta de organização **não**
   precisa do teste fechado de 12 pessoas por 14 dias que as contas pessoais novas exigem.
2. **Chave de envio** (uma vez só): no GitHub, Settings → Secrets → Actions, criar
   `ANDROID_KEYSTORE_SENHA` (senha longa, guardada no gerenciador de senhas).
   Rodar o workflow **gerar chave de envio**, baixar o resultado, copiar o
   conteúdo de `chave-base64.txt` para o secret `ANDROID_KEYSTORE_BASE64`,
   guardar o `.jks` em lugar seguro e apagar a execução no GitHub.
3. Rodar **versão para a loja (AAB)** → baixar os dois `.aab`.
4. No Play Console, criar os dois apps (nome, idioma português, "App", "Gratuito"),
   aceitar o **Play App Signing** e subir o `.aab` em **Teste interno** (o
   primeiro envio de cada app é à mão; depois o workflow pode subir sozinho com
   o secret `PLAY_CONTA_DE_SERVICO_JSON`).
5. Preencher a ficha da loja (textos da seção 4), as imagens, e os formulários
   da seção 5 (segurança dos dados, classificação, público-alvo, acesso ao app).
6. Testar pelo link do teste interno → promover para **Produção** → revisão
   (normalmente de horas a poucos dias).

### App Store (iPhone)
1. **Apple Developer Program da Hemoderi** como *organização* (D-U-N-S) —
   US$ 99 por ano. Convidar `odilontech@gmail.com` como **Admin** em App Store Connect.
2. No App Store Connect: **Apps → +**, criar os dois apps com os identificadores
   acima (o identificador aparece depois de registrado em Certificates,
   Identifiers & Profiles → Identifiers, ou já na criação do app).
3. **Chave de API** (Usuários e acesso → Integrações → App Store Connect API →
   gerar chave com papel *App Manager*) e os secrets do GitHub:
   `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
   `APP_STORE_CONNECT_KEY_P8` (conteúdo do `.p8`, que só baixa uma vez).
4. Rodar **App iOS — enviar para o TestFlight** → em alguns minutos o build
   aparece no TestFlight. Testar no iPhone pelo app TestFlight.
5. Preencher a ficha (seção 4), as capturas, **Privacidade do app** (seção 5),
   as notas para a revisão (seção 6) e enviar para revisão.

## 3. O que ainda falta construir
- **Push no iPhone**: no iOS o aparelho entrega um código da Apple (APNs), e o
  sistema envia pelo Firebase. Falta trocar o registro do push para o plugin do
  Firebase Messaging no app e cadastrar a chave APNs no Firebase. Fazer quando a
  conta Apple existir, testando num iPhone pelo TestFlight. Sem isso o app do
  iPhone funciona, só não recebe notificação.
- **Capturas de tela**: com as contas de teste (seção 6) e dados fictícios.
  Google Play: no mínimo 2 por app (celular, retrato). App Store: iPhone 6,9"
  (1320 × 2868) ou 6,5" (1284 × 2778), de 3 a 10 por app.

## 4. Textos da ficha (copiar e colar)

### Hemoderi (clínica)
- **Nome**: Hemoderi
- **Subtítulo (Apple, 30)**: Atendimentos da sua clínica
- **Descrição curta (Google, 80)**: Agende, acompanhe e pague os atendimentos da Hemoderi na sua clínica.
- **Palavras-chave (Apple, 100)**: hemoderi,clinica,odontologia,agendamento,PRF,sedacao,laser,atendimento,equipamento
- **Categoria**: Empresas (Google) / Negócios (Apple)
- **Descrição completa**:

> O app da Hemoderi para clínicas e consultórios parceiros.
>
> • Agende atendimentos com os profissionais e equipamentos da Hemoderi, escolhendo data, horário e serviço.
> • Acompanhe cada agendamento: confirmação, profissional a caminho, atendimento realizado.
> • Receba avisos no celular quando o agendamento é confirmado ou muda.
> • Pague por Pix ou cartão de crédito e baixe o recibo.
> • Consulte o histórico e o relatório de cada atendimento.
> • Entrada protegida por biometria ou Face ID.
>
> Para clínicas já cadastradas na Hemoderi. Dúvidas: andre@hemoderi.com.br

### Hemoderi Profissional
- **Nome**: Hemoderi Profissional
- **Subtítulo (Apple, 30)**: Agenda e relatórios em campo
- **Descrição curta (Google, 80)**: Seus atendimentos Hemoderi: aceite, chegada, relatório e repasse no celular.
- **Palavras-chave (Apple, 100)**: hemoderi,profissional,agenda,relatorio,atendimento,repasse,odontologia,PRF,sedacao
- **Categoria**: Empresas (Google) / Negócios (Apple)
- **Descrição completa**:

> O app dos profissionais da Hemoderi.
>
> • Veja e aceite os atendimentos que a central alocou para você.
> • Receba aviso no celular quando há atendimento novo ou mudança de horário.
> • Registre a chegada no local com um toque ("Cheguei").
> • Preencha o relatório do atendimento em campo, com fotos e comprovantes pela câmera.
> • Acompanhe o que tem a receber de cada atendimento.
> • Entrada protegida por biometria ou Face ID.
>
> Para profissionais cadastrados pela Hemoderi. Dúvidas: andre@hemoderi.com.br

> Conferir com o André o e-mail de contato público (hoje `andre@hemoderi.com.br`)
> e a revisão jurídica da política de privacidade antes de publicar.

## 5. Formulários de privacidade (respostas sugeridas — revisar com o jurídico)

**Coleta de dados** (Google: Segurança dos dados · Apple: Privacidade do app).
Nada é usado para publicidade nem rastreamento entre apps; tudo é para o
funcionamento do app e vinculado à conta. Dados em trânsito são criptografados
(HTTPS). O usuário pode pedir a exclusão (no app e na URL de exclusão).

| Dado | Clínica | Profissional | Para quê |
| --- | --- | --- | --- |
| Nome, e-mail, telefone | sim | sim | conta e contato |
| Localização precisa | não | sim | registrar a chegada ao atendimento |
| Fotos e arquivos | sim (comprovantes) | sim (relatório, comprovantes) | anexos do atendimento |
| Informações de saúde (dados do atendimento do paciente) | sim (relatório) | sim (relatório, sinais vitais) | registro do atendimento |
| Histórico de compras / pagamentos | sim | não | cobranças e recibos |
| Identificadores do aparelho (código de push) | sim | sim | notificações |

Pagamento com cartão: os dados do cartão são digitados na página do Asaas, não
ficam no app nem no sistema.

**Classificação indicativa** (Google: questionário IARC · Apple: idade): sem
violência, sexo, drogas, jogos de azar ou conteúdo gerado por usuários públicos →
**Livre / 4+**. **Público-alvo**: maiores de 18. **Anúncios**: não. **App de
saúde (Google)**: declarar como ferramenta de gestão de atendimentos para
profissionais e clínicas, sem diagnóstico nem tratamento.

## 6. Acesso para a revisão (as lojas exigem)
- Criar **uma conta de clínica de teste** e **uma conta de profissional de teste**,
  com dados fictícios e alguns atendimentos de exemplo, sem biometria obrigatória.
- Informar usuário e senha no Play Console (Conteúdo do app → Acesso ao app) e
  no App Store Connect (Informações para a revisão).
- **Notas para a revisão da Apple** (para não cair na regra 4.2, "app que é só
  um site"):

> Hemoderi is a B2B app for partner clinics (and, in the Professional app, for
> field professionals) of Hemoderi, a provider of dental and medical equipment
> and specialists. Accounts are created by Hemoderi; please use the demo
> credentials provided. Native features used: push notifications for booking
> confirmations and assignments, Face ID/biometric lock, camera for attaching
> photos and receipts to the service report, and (Professional app) location to
> register arrival at the clinic. Account deletion is available in the app:
> Clinic app → Configurações → "Excluir minha conta"; Professional app →
> Meus dados → "Excluir minha conta".
