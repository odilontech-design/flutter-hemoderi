# Colocar no ar

Do zero ao sistema publicado. Leva por volta de 20 minutos, e o caminho é o
mesmo que os outros produtos da linha usam: banco no **Neon**, aplicação na
**Vercel**.

## 1. Banco (Neon)

1. Crie um projeto no [Neon](https://neon.tech) na região **AWS South America
   (São Paulo)** — o mesmo lado do `gru1` da Vercel, para não pagar latência de
   ida e volta a cada consulta.
2. Copie as duas strings de conexão do painel:
   - a **com** `-pooler` no host → `DATABASE_URL`
   - a **sem** `-pooler` → `DATABASE_URL_UNPOOLED`

As duas são necessárias e não são intercambiáveis. Pelo pooler, o advisory
lock do Prisma Migrate fica preso numa conexão do PgBouncer e a migration
trava com timeout — por isso as migrations usam a conexão direta.

## 2. Aplicação (Vercel)

1. Importe o repositório na Vercel. O `vercel.json` já fixa o framework e a
   região `gru1`.
2. Configure as variáveis de ambiente (Production **e** Preview):

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | conexão com `-pooler` |
| `DATABASE_URL_UNPOOLED` | conexão sem `-pooler` |
| `NEXTAUTH_SECRET` | gere com `openssl rand -base64 32` |
| `NEXTAUTH_URL` | a URL final, ex. `https://operacoes.hemoderi.com.br` |
| `CRON_SECRET` | gere com `openssl rand -base64 32` |
| `SETUP_SECRET` | gere com `openssl rand -hex 24` — só para o próximo passo, dá para remover depois |

`NEXTAUTH_URL` precisa ser a URL **definitiva**: é dela que sai o link de
divulgação impresso no QR Code de cada clínica. Trocar o domínio depois
invalida os QR Codes já distribuídos.

As variáveis das integrações (`PIPEDRIVE_*`, `GOOGLE_*`, `WHATSAPP_*`) ficam
vazias até a Fase 4. Sem elas o sistema opera normalmente — as integrações
registram a intenção em `SincronizacaoExterna` em vez de falhar.

3. Faça o deploy. O `prebuild` roda `prisma generate && prisma migrate deploy`,
   então o schema é aplicado sozinho no primeiro build. O schema declara
   `DATABASE_URL_UNPOOLED` como `directUrl`, e é essa a conexão que o Migrate
   usa de verdade — sem a variável configurada, esse passo trava sozinho na
   primeira migration.

## 3. Primeiro acesso e catálogo

Não há tela pública de cadastro: quem cria um usuário interno enxerga a
operação inteira, e essa porta não se abre pela internet sem controle. Em vez
de exigir acesso direto ao banco de produção (nem sempre disponível de onde o
deploy é conduzido), abra uma vez, no navegador:

```
https://SEU-DOMINIO/api/setup?key=O-VALOR-DE-SETUP_SECRET
```

A página carrega o catálogo real (18 serviços, equipamentos) e cria o
primeiro acesso interno com o nome, e-mail e senha que você informar. A rota
se tranca sozinha assim que existe qualquer usuário interno — não é uma porta
que fica aberta esperando alguém achar a chave. Depois de usar, pode remover
`SETUP_SECRET` do ambiente.

Dali em diante, os demais acessos (equipe, clínicas e profissionais) são
criados pela tela **Acessos** do painel — nunca mais por aqui.

Com acesso direto à conexão de produção (de uma máquina que alcance o Neon),
`npm run db:usuario` continua funcionando como sempre para criar ou resetar um
acesso pontual — mas só `/api/setup` carrega o catálogo junto, então é o
caminho preferido para a configuração inicial.

## 4. Conferir

```bash
curl https://SEU-DOMINIO/api/saude
# {"ok":true,"banco":"conectado","schema":"aplicado"}
```

`schema: "ausente"` significa que a aplicação subiu mas as migrations não
rodaram — é a diferença entre "publicou" e "funciona".

Para conferir o ciclo inteiro num ambiente de **homologação** (nunca em
produção — o script cria e fecha um atendimento de verdade):

```bash
npm run db:seed
BASE_URL=https://SEU-AMBIENTE npm run fumaca
```

O teste percorre o caminho que o dinheiro faz: a clínica agenda pelo portal,
remarca, a equipe confirma e aloca, o atendimento é fechado e o repasse
aparece no financeiro.

## 5. Rotina de lembretes

O `vercel.json` já registra o cron de hora em hora em
`/api/rotinas/mensagens`. A Vercel envia o `CRON_SECRET` no cabeçalho
`Authorization`; sem a variável configurada, a rota fica aberta — configure-a.

A rotina é idempotente: rodar duas vezes não manda o lembrete duas vezes.
Enquanto o WhatsApp não estiver ligado (Fase 4), ela enfileira as mensagens e
elas ficam visíveis como pendentes, sem envio.

## 6. Domínio

Aponte o domínio definitivo na Vercel e ajuste `NEXTAUTH_URL` para ele. Só
depois disso imprima os QR Codes das clínicas.

## Ambiente local

```bash
npm install
cp .env.example .env     # preencha DATABASE_URL e NEXTAUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev              # http://localhost:3003
```

Acessos do seed (senha `hemoderi123`): `equipe@hemoderi.com.br`,
`clinica-santa-rita@exemplo.com.br`, `ana@exemplo.com.br`.
