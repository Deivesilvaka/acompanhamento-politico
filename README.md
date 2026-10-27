# Acompanhamento Político

Newsletter diária e gratuita sobre as leis votadas no Congresso Nacional: o que foi votado, o resultado, quem votou a favor, quem votou contra e quem não votou. Tudo roda numa única API: site público, inscrição, busca diária dos dados oficiais, envio dos e-mails e arquivo público de tudo o que foi enviado.

Stack: NestJS 12 + TypeORM 1 + PostgreSQL 17, mesma organização do `recipies-app`.

---

## Como funciona

```
18:00 e 23:00  ┌──────────────────────────┐   Dados Abertos da Câmara
  ingestão ───▶│ legislative (clients)    │◀─ Dados Abertos do Senado
               └────────────┬─────────────┘
                            ▼
                   votings / votes / parliamentarians (Postgres)
                            │
05:00 envio    ┌────────────▼─────────────┐
  (+ retry a   │ newsletter (DigestService)│── renderiza o e-mail 1x ──▶ newsletter_editions
  cada 15 min, └────────────┬─────────────┘    (arquivo público)
  05h–17h)                  ▼
                 lotes de 200 inscritos · 5 envios simultâneos · rate limit SMTP
```

| Módulo | Responsabilidade |
|---|---|
| `legislative` | Busca votações nominais de leis (PL, PLP, PEC, MPV, PLV, PDL) no plenário, com o voto de cada parlamentar. API pública de consulta. |
| `subscriptions` | Inscrição com double opt-in, confirmação e cancelamento. |
| `email` | Templates (mesmo padrão do recipies: enum + mapa + `sendTemplate`) e envio SMTP. |
| `newsletter` | Edições diárias, envio em lotes com retomada, arquivo público e agendamentos. |
| `public/` | Site estático servido pela própria API. |

### Fontes oficiais

- Câmara: `https://dadosabertos.camara.leg.br/api/v2` (votações do Plenário, votos, deputados em exercício)
- Senado: `https://legis.senado.leg.br/dadosabertos` (votações com o voto de cada senador)

Votações simbólicas não têm voto individual registrado e por isso não entram. Na Câmara, "não votou" é calculado assim: deputados em exercício na data menos os que registraram voto. A fonte oficial não informa justificativa por votação. O Senado informa licenças e missões, que aparecem como "ausência justificada".

### Envio econômico e garantido (sem infraestrutura paga)

- **O próprio Postgres é a fila.** Não há Redis, SQS nem worker separado.
- **Renderiza uma vez por edição.** O e-mail é igual para todos; por inscrito só se troca o link pessoal de cancelamento (`personalizeContent`).
- **Lotes**: 200 inscritos por consulta (paginação por id), 5 envios simultâneos e pool SMTP com `MAIL_MAX_PER_SECOND`.
- **Retomada**: os entregues são marcados a cada 5 envios. Se o processo cair, a próxima execução continua de onde parou.
- **Retry por inscrito**: recusa temporária do destinatário (`RCPT TO` 4xx, ex.: caixa cheia) faz o inscrito voltar para a fila, e o job de 15 em 15 min reenvia (até 5 tentativas). Destinatário inexistente (`RCPT TO` 5xx) não é reenviado.
- **Circuit breaker**: se a falha é do provedor (fora do ar, senha errada, TLS, remetente ou conteúdo recusado), a passada para no primeiro lote, **ninguém perde tentativa** e a edição fica aberta até o provedor voltar. Uma queda longa do SMTP não faz ninguém deixar de receber.
- **Execução única**: advisory lock do Postgres garante que só uma réplica envia, mesmo com várias rodando.
- **Ingestão incremental**: votações já salvas não são baixadas de novo (voto nominal registrado não muda). A rodada das 23h só busca o que é novo desde as 18h.

### Transparência

Cada resumo enviado fica salvo e público em `/arquivo`. Os filtros são texto, Câmara/Senado e período. Lá aparecem o e-mail exatamente como foi enviado, as votações incluídas e o número de entregues e de falhas. O conteúdo salvo não tem dado de quem recebeu.

### Observações editoriais por IA

Cada proposta do resumo diário pode trazer uma **Observação**, escrita por IA com a voz de um jornalista progressista, em tom duro e direto. Também traz contexto que o placar não mostra.

- **Linha editorial** ([editorial-observation.prompt.ts](src/ai/prompts/editorial-observation.prompt.ts)):
  - A **primeira frase** expõe o partido ou grupo de partidos que agiu contra o trabalhador: votou contra, tentou barrar ou desidratar, ou foi contra desde o início e mudou de lado na hora de votar.
  - A **crítica dura à direita e às suas contradições é obrigatória** sempre que houver base (discurso x voto, histórico, mudança perto da eleição). Outros partidos, inclusive de esquerda, também são criticados quando houver motivo.
  - Foca em **partidos e blocos**. Pode citar nomes, desde que o fato esteja nos dados ou em fonte consultada. Quando há poucos votos contra (até 3), os nomes de quem votou contra vêm do nosso banco, e a IA não precisa adivinhar.
  - **Só controvérsia que aconteceu**: está nos dados ou em fonte consultada. Mudança de posição comprovada é dita com todas as letras. O motivo ("cálculo eleitoral") aparece como leitura. Intenção futura ("vão revogar") só entra com declaração publicada. Isso protege contra acusação sem prova em ano eleitoral (art. 323 do Código Eleitoral).
- **Quando aparece**: se a IA não encontrar nada relevante e verificável, a proposta fica sem observação. Se o projeto for bom para a classe trabalhadora, a observação **sempre** aparece destacando isso.
- **Quem escreve, em ordem** ([src/ai/](src/ai/)):
  1. **Groq** (`openai/gpt-oss-120b`, depois `openai/gpt-oss-20b`), com **busca na web** (`browser_search`). No plano gratuito, cada modelo tem **200 mil tokens/dia** e cada busca gasta cerca de 33 mil. Com dois modelos, cabem cerca de 12 propostas por dia com web.
  2. **NVIDIA**, sem busca na web, que escreve **só com os dados oficiais** recebidos. Os modelos vêm de `NVIDIA_MODEL`, em ordem: `deepseek-ai/deepseek-v4.1-flash`, `nvidia/nemotron-3-ultra-550b-a55b` e `openai/gpt-oss-20b`. Assim o sistema não depende só do Groq.
  3. **Resumo automático** em código, se todas as IAs falharem (ver abaixo).
- **Dados de base**: a IA recebe a ementa, as votações e a **posição de cada partido** do nosso banco. Os números vêm da fonte oficial, não da memória do modelo.
- **Fatos calculados em código**: a IA não lê a tabela crua de votos.
  - Ela recebe os partidos já separados em "maioria a favor", "maioria contra" e "divididos" (critério: 2/3 dos votos sim + não).
  - Recebe também frases prontas sobre os votos contra, por exemplo: "PL: 11 votos contra, mas a maioria do partido votou a favor" e "foi o voto isolado de um parlamentar, não a posição do partido".
  - Antes disso, os modelos generalizavam um voto isolado para o partido inteiro ou omitiam o partido que mais votou contra.
- **Checagem do texto em código**: a observação é descartada, e a próxima IA tenta, quando:
  - diz que um grupo foi o "único" a votar contra, mas outros partidos também votaram contra;
  - diz que o projeto "foi aprovado/rejeitado" quando a votação principal era só de uma parte (emenda, subemenda, destaque ou requerimento). Nesse caso a IA também recebe um fato pronto avisando isso.
  - (só modelos sem web) cita número ligado a tempo ("quatro dias", "36 horas") que não está na ementa nem na descrição oficial.
  - Esse descarte não conta como falha do provedor.
- **Sem web, sem chute**: os modelos sem busca não podem citar autor, histórico, próximos passos da tramitação nem "fechou questão" (decisão formal do partido que o placar não comprova).
- **Economia**:
  - Uma chamada por proposta, por edição (nunca por inscrito), com no máximo 12 por dia.
  - Respeita o limite por minuto do plano gratuito (espera o `Retry-After` até `AI_MAX_WAIT_SECONDS`). Quando o limite é o diário, a espera seria de horas: passa direto para a próxima IA.
  - Um modelo que falha 2 vezes na mesma edição é pulado no resto dela. Se estourar o tempo (`AI_TIMEOUT_SECONDS`), é pulado já na primeira vez.
  - Se todas as IAs falharem, o próprio código monta a observação com os votos oficiais (quais partidos votaram contra e quantos), com rótulo próprio de "resumo automático". A proposta não fica sem observação e **a IA nunca bloqueia o envio**.
- **Rótulo no e-mail**: a observação de IA aparece como *"Análise editorial gerada por IA… É opinião, não dado oficial"*, com os domínios das fontes consultadas. O resumo automático tem rótulo próprio (*"Resumo automático dos votos oficiais por partido…"*) e não se passa por IA.
- **Auditoria**: a tabela `edition_observations` guarda texto, provedor, modelo e fontes de cada observação enviada. No resumo automático, o provedor é `dados-oficiais`.
- **Modos** (`AI_OBSERVATIONS_MODE`): `live` usa as IAs de verdade; `mock` usa texto simulado, sem custo (padrão local); `off` desliga (nenhuma chamada de IA). O **seed não chama IA**: as observações só são geradas na criação da edição.

---

## Segurança e privacidade

- **Double opt-in**: ninguém consegue inscrever o e-mail de outra pessoa.
- **Anti-enumeração**: a inscrição responde sempre a mesma mensagem, e o e-mail é enviado em segundo plano.
- **Anti e-mail bombing**: rate limit de 5 inscrições a cada 15 min por IP e cooldown de 10 min por endereço.
- **Tokens**: a confirmação usa 256 bits aleatórios, guarda só o hash SHA-256, vale 24h e é de uso único. O cancelamento usa HMAC-SHA256 sem estado, com comparação em tempo constante.
- **Cancelar = apagar** o e-mail da base (LGPD). Pedidos não confirmados são apagados em 24h.
- **Cancelamento fácil**: botão grande no final de todo e-mail, mais `List-Unsubscribe` / `List-Unsubscribe-Post` (RFC 8058) para o botão nativo do Gmail e do Outlook.
- **Confirmar e cancelar exigem um clique (POST)**: antivírus que abrem links não disparam a ação.
- **Templates**: todo dado externo passa por `escapeHtml`. Os links usam sempre `PUBLIC_URL`, nunca o header `Host`.
- **Site**: CSP estrita (sem script inline), sem CORS (mesma origem), dados inseridos via `textContent`.
- **SQL**: só queries parametrizadas; curingas do `ILIKE` são escapados.
- **Fontes externas**: allowlist de host (inclusive nos links de paginação), timeout, limite de tamanho e validação de formato.
- **Config fail secure**: a API não sobe com segredo curto, sem https em produção ou aceitando certificado autoassinado em produção.
- **Logs sem PII**: nada de e-mail nem token nos logs (só o id do inscrito) e nenhuma query SQL logada.
- **IA**:
  - **O que sai**: só dados públicos (votação, ementa, votos por partido), nunca dado de inscrito.
  - **Resposta não confiável**: a resposta é tratada como input não confiável, porque páginas pesquisadas podem tentar *prompt injection*. O texto passa por sanitização: sem links, HTML ou markdown, com limite de tamanho e HTML escapado. As fontes aparecem só como domínio, sem link clicável.
  - **Chamadas**: allowlist de hosts, timeout e limite de tamanho da resposta.
  - **Fail secure**: a API não sobe em modo `live` sem nenhuma chave.
- **Erros**: nenhuma stack trace chega ao cliente.
- **Container**: multi-stage, usuário `node`, filesystem somente leitura e `no-new-privileges`.

---

## O que é necessário para rodar

| Requisito | Versão | Para quê |
|---|---|---|
| Node.js | 24 (exata em [.nvmrc](.nvmrc): `nvm use`) | Rodar a API, scripts e testes |
| npm | 11+ (vem com o Node 24) | Dependências |
| Docker + Docker Compose | Docker 24+ / Compose v2 (ex.: Rancher Desktop) | Postgres e Mailpit locais |
| Acesso à internet | — | Buscar dados em `dadosabertos.camara.leg.br` e `legis.senado.leg.br` |

> **Rancher Desktop:** em *Preferences → Container Engine*, use **dockerd (moby)**. Com `containerd` o comando `docker compose` não funciona.

Portas usadas localmente (todas presas a `127.0.0.1`):

| Porta | Serviço |
|---|---|
| 3000 | API e site |
| 5432 | Postgres (`DB_PORT`) |
| 1025 | SMTP do Mailpit |
| 8025 | Caixa de entrada do Mailpit (web) |

Não é preciso nenhuma conta paga. Localmente os e-mails são capturados pelo Mailpit e nada sai para a internet.

---

## Setup passo a passo

### 1. Instalar dependências

```bash
nvm use          # Node 24
npm install
```

### 2. Criar o `.env`

```bash
cp .env.example .env
```

Preencha os dois segredos com valores aleatórios. Nunca reutilize valores de exemplo:

```bash
# UNSUBSCRIBE_TOKEN_SECRET (mínimo 32 caracteres)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# DB_PASSWORD
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

O `.env` está no `.gitignore` e nunca deve ser versionado. O restante já vem pronto para o ambiente local.

### 3. Subir Postgres e Mailpit

```bash
docker compose up -d db mailpit
docker compose ps        # aguarde o db aparecer como "healthy"
```

### 4. Criar as tabelas

```bash
npm run migration:run
```

### 5. Popular o banco com o seed (recomendado)

Sem isso o site fica vazio até a primeira ingestão agendada (18h).

```bash
npm run db:seed
```

O seed ([seeds.ts](src/shared/database/seeds/seeds.ts)) **busca dados reais nas fontes oficiais**; nada é inventado. Ele traz as **2 votações de lei mais recentes da Câmara e 2 do Senado** dos últimos 10 dias, com o voto de cada parlamentar e quem não votou.

- **Sempre traz dados**: se não houve votação nominal nos últimos 10 dias (recesso, eleições), ele recua de 10 em 10 dias até encontrar, com limite de 1 ano.
- **Mesmo pipeline da ingestão diária**: allowlist de hosts, validação dos dados e upsert. Pode rodar quantas vezes quiser sem duplicar.
- **Só local**: se recusa a rodar com `NODE_ENV=prd`.
- **Precisa de internet** e leva cerca de 1 minuto, porque a Câmara exige várias chamadas por votação.

Quer mais dados para navegar? Carregue um período inteiro:

```bash
npm run ingest -- 2026-03-01 2026-07-31   # alguns minutos por mês
```

### 6. Iniciar a API

```bash
npm run start:dev
```

| Endereço | O que é |
|---|---|
| http://localhost:3000 | Site público |
| http://localhost:3000/docs | Swagger (só fora de produção) |
| http://localhost:8025 | E-mails enviados (Mailpit) |
| http://localhost:3000/health | Healthcheck |

### 7. Testar o fluxo completo na mão

1. No site, inscreva um e-mail qualquer (ex.: `teste@example.com`).
2. Abra o Mailpit (http://localhost:8025), abra o e-mail de confirmação e clique em **Confirmar inscrição**.
3. Envie o resumo agora, sem esperar as 5h:
   ```bash
   npm run digest:send
   ```
4. Veja o resumo no Mailpit e no arquivo público (http://localhost:3000/arquivo).
5. Clique em **Cancelar inscrição** no final do e-mail. O endereço é apagado da base.

O resumo só é gerado quando há votações ainda não enviadas. Rodar `digest:send` de novo não reenvia nada.

### 8. Receber os e-mails de verdade (opcional)

O Mailpit é um servidor de e-mail **falso**: guarda as mensagens em http://localhost:8025 e não entrega nada. Para receber na sua caixa de entrada, troque-o por um SMTP real no `.env`. O código não muda.

**Gmail (grátis, só para teste pessoal):**

1. Ative a verificação em duas etapas na conta Google.
2. Gere uma **senha de app** em https://myaccount.google.com/apppasswords. Nunca use a senha normal da conta.
3. No `.env`:
   ```env
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_SECURE=false
   MAIL_ALLOW_SELF_SIGNED=false
   MAIL_USER=sua.conta@gmail.com
   MAIL_PASSWORD=<senha de app de 16 letras>
   MAIL_SENDER_DEFAULT=sua.conta@gmail.com   # o Gmail exige remetente = conta autenticada
   MAIL_MAX_PER_SECOND=1
   ```
4. Reinicie a API e repita o passo 7 com **o seu** e-mail.

Cuidados:

- **Apague inscritos fictícios antes de enviar.** Endereços de teste (ex.: `@example.com`) receberiam envios reais e prejudicam a reputação da conta:
  ```bash
  docker compose exec db sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "delete from subscribers where email like '"'"'%@example.com'"'"';"'
  ```
- **Links só neste computador**: com `PUBLIC_URL=http://localhost:3000`, os links dos e-mails só abrem aqui.
- **A API rodando envia de verdade**: às 05h o resumo vai para todos os inscritos confirmados.
- **Para voltar ao Mailpit**: restaure os valores de e-mail do `.env.example`, apague a senha do `.env` e **revogue a senha de app** no Google.

O Gmail **não serve para produção**: tem limite diário baixo e não autentica domínio próprio. Veja [Antes de ir para produção](#antes-de-ir-para-produção).

### Rodar a API também em container

```bash
docker compose --profile api up --build
```

A imagem aplica as migrations pendentes ao iniciar. Ela usa o mesmo `.env`; host e porta do banco e do SMTP são ajustados pelo compose.

---

## Variáveis de ambiente

A API valida tudo ao iniciar e **não sobe** se algo estiver ausente ou inseguro. O erro lista só os nomes das variáveis, nunca os valores.

| Variável | Obrigatória | Exemplo local | Descrição |
|---|---|---|---|
| `NODE_ENV` | sim | `local` | `local`, `dev`, `hml`, `prd` ou `test`. Em `prd` o Swagger fica desligado e há regras extras. |
| `APP_PORT` | não | `3000` | Porta HTTP. |
| `APP_NAME` | sim | `Acompanhamento Político` | Nome nos e-mails. |
| `PUBLIC_URL` | sim | `http://localhost:3000` | Base dos links nos e-mails. **https obrigatório em `prd`.** |
| `TRUST_PROXY_HOPS` | sim | `0` | Proxies confiáveis à frente da API (0 = acesso direto). |
| `UNSUBSCRIBE_TOKEN_SECRET` | sim | *(aleatório)* | Segredo HMAC dos links de cancelamento, mín. 32 caracteres. Trocar invalida todos os links já enviados. |
| `DB_HOST` / `DB_PORT` | sim | `localhost` / `5432` | Postgres. |
| `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | sim | `app` / *(aleatório)* / `acompanhamento_politico` | Credenciais. O compose usa os mesmos valores para criar o banco. |
| `DB_SSL` | sim | `false` | `true` em bancos gerenciados (valida o certificado). |
| `MAIL_HOST` / `MAIL_PORT` | sim | `localhost` / `1025` | Servidor SMTP. |
| `MAIL_SECURE` | sim | `false` | `true` = TLS na porta 465. `false` = STARTTLS **obrigatório** (587). |
| `MAIL_ALLOW_SELF_SIGNED` | sim | `true` | Aceita o certificado de teste do Mailpit. **Proibido em `prd`.** |
| `MAIL_USER` / `MAIL_PASSWORD` | sim | `dev` / `dev` | Credenciais SMTP. O Mailpit aceita qualquer valor. |
| `MAIL_MAX_PER_SECOND` | sim | `10` | Limite de envios por segundo; ajuste ao plano do provedor. |
| `MAIL_SENDER_DEFAULT` / `MAIL_SENDER_NAME_DEFAULT` | sim | `no-reply@example.com` | Remetente. |
| `INGESTION_CRON` | sim | `0 18,23 * * *` | Quando buscar os dados oficiais. |
| `DIGEST_CRON` | sim | `0 5 * * *` | Quando enviar o resumo. |
| `DIGEST_RETRY_CRON` | sim | `*/15 5-17 * * *` | Quando retomar envios com falha temporária. |
| `INGESTION_LOOKBACK_DAYS` | sim | `1` | Quantos dias para trás cada ingestão reconsulta (1 a 30). |
| `AI_OBSERVATIONS_MODE` | sim | `mock` | `live` (IAs de verdade), `mock` (texto simulado, sem custo) ou `off`. `live` exige ao menos uma chave. |
| `AI_TIMEOUT_SECONDS` | sim | `120` | Tempo máximo por chamada de IA (5 a 180). Modelo que estoura o prazo é pulado no resto da edição. |
| `AI_MAX_WAIT_SECONDS` | sim | `300` | Espera máxima quando a IA pede para aguardar (limite por minuto do plano gratuito). |
| `GROQ_API_KEY` / `GROQ_MODEL` | não | — / `openai/gpt-oss-120b` | IA principal, com busca na web. Aceita lista de modelos separada por vírgula (recomendado: `openai/gpt-oss-120b,openai/gpt-oss-20b`, cada um com sua cota diária). |
| `NVIDIA_API_KEY` / `NVIDIA_MODEL` | não | — / `deepseek-ai/deepseek-v4.1-flash` | IA reserva, sem busca. Aceita lista em ordem de preferência (ex.: `deepseek-ai/deepseek-v4.1-flash,nvidia/nemotron-3-ultra-550b-a55b,openai/gpt-oss-20b`). |

Os horários de cron usam o fuso `America/Sao_Paulo`.

---

## Testes

```bash
npm test             # roda todos os testes unitários
npm run test:watch   # modo watch
npm run test:cov     # com relatório de cobertura em coverage/
```

Os testes unitários não precisam de banco, Docker nem internet. Ficam em [test/unit/](test/unit/):

| Arquivo | O que garante |
|---|---|
| `secure-token.helper.spec.ts` | Tokens aleatórios; links de cancelamento adulterados, de outro propósito ou de outro segredo são recusados. |
| `html-escape.helper.spec.ts` | Escape de HTML (contra injeção nos e-mails) e de curingas da busca. |
| `email-templates.spec.ts` | Todo e-mail tem o botão de cancelar no final (HTML e texto) e os cabeçalhos de cancelamento em um clique. Dados externos são escapados. Renderizar uma vez e personalizar só o link funciona. |
| `digest-builder.spec.ts` | Agrupamento por lei, prioridade (PEC primeiro) e limite de tamanho do e-mail. |
| `vote-type.mapper.spec.ts` | Tradução dos códigos de voto da Câmara e do Senado. |
| `observation-parser.spec.ts` | Resposta da IA vira texto puro e curto: sem links, HTML, markdown nem marcadores de citação (anti prompt injection). Texto que diz "únicos contra" contrariando o placar, que trata votação de subemenda como do projeto inteiro ou que inventa número de dias/horas é recusado. |
| `camara-date-range.spec.ts` | A consulta de votações da Câmara pede até o dia seguinte, porque a API trata a data final como exclusiva. Sem isso, um único dia não trazia nada. |
| `observation-fallback.spec.ts` | Troca de IA quando uma falha, "sem observação" não gasta outra chamada, circuit breaker por provedor (timeout pula na hora) e resumo automático pelos votos oficiais quando todas falham. |
| `party-positions.spec.ts` | Posição de cada partido (maioria a favor, contra, dividido) e frases sobre os votos contra calculadas em código, sem generalizar voto isolado. |
| `smtp-error-classification.spec.ts` | Falha do provedor ou do remetente nunca é confundida com destinatário inválido, então os inscritos não perdem o e-mail. |
| `env.validation.spec.ts` | A API recusa configuração insegura (segredo curto, http ou certificado de teste em produção). |

### Checagens antes de abrir PR

```bash
npx tsc -p tsconfig.json --noEmit   # tipos (código + testes)
npm test
npm run build
npm audit
```

### Testando falhas de envio (opcional)

O Mailpit local simula erros de SMTP. Com isso dá para verificar o reenvio automático:

```bash
# 30% dos destinatários recebem erro permanente 550
curl -X PUT http://localhost:8025/api/v1/chaos -H 'Content-Type: application/json' \
  -d '{"Recipient":{"ErrorCode":550,"Probability":30}}'

npm run digest:send

# desliga a simulação
curl -X PUT http://localhost:8025/api/v1/chaos -H 'Content-Type: application/json' \
  -d '{"Recipient":{"ErrorCode":0,"Probability":0}}'
```

Para simular o servidor de e-mail fora do ar, rode `docker compose stop mailpit`, depois `npm run digest:send`, depois `docker compose start mailpit` e por fim `npm run digest:send -- --retry`. Todos devem receber, sem duplicados.

### Verificando o schema do banco

Depois de alterar uma entidade, gere a migration e confira se não sobrou diferença:

```bash
npm run migration:generate --name=DescricaoDaMudanca
npm run migration:run
npm run typeorm -- migration:generate ./src/shared/database/migrations/Check \
  -d ./src/config/dataSource.ts --dryrun   # deve dizer "No changes"
```

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Variáveis de ambiente inválidas ou ausentes: ...` | `.env` incompleto ou segredo curto | Preencha as variáveis listadas (ver [Variáveis de ambiente](#variáveis-de-ambiente)). |
| `Cannot connect to the Docker daemon` / `connection reset by peer` | Rancher Desktop parado ou reiniciando | Abra o Rancher, aguarde ficar pronto e confira `docker ps`. |
| `Unable to connect to the database` | Postgres não subiu ou porta diferente | `docker compose ps`; confira `DB_PORT` no `.env`. |
| `The server does not support SSL connections` | `DB_SSL=true` com o Postgres local | Use `DB_SSL=false` localmente. |
| E-mails não aparecem no Mailpit | Mailpit parado ou `MAIL_PORT` errada | `docker compose up -d mailpit`; `MAIL_PORT=1025`. |
| `self-signed certificate` ao enviar | `MAIL_ALLOW_SELF_SIGNED=false` com o Mailpit | Use `true` **somente** localmente. |
| Log `Falha ao enviar e-mail (SERVER): EAUTH` | Senha errada, senha normal em vez de senha de app, ou verificação em duas etapas desligada | Gere uma nova senha de app e confira se `MAIL_USER` é a conta dona dela. |
| E-mail real não chega | Filtro de spam ou remetente diferente da conta | Olhe o spam; com Gmail, `MAIL_SENDER_DEFAULT` deve ser igual a `MAIL_USER`. |
| Envio "pausado até o próximo retry" | Provedor SMTP fora do ar ou recusando o remetente | Nenhum inscrito perde o e-mail: o job de 15 em 15 min retoma sozinho. Corrija a credencial e rode `npm run digest:send -- --retry`. |
| `429 Too Many Requests` na inscrição | Rate limit (5 tentativas a cada 15 min por IP) | Aguarde, ou reinicie a API em desenvolvimento. |
| Site sem votações | Nenhuma ingestão rodou ainda | `npm run db:seed` |
| `digest:send` diz "Nenhuma votação nova" | Todas as votações já foram enviadas | Esperado. Rode uma nova ingestão para trazer votações novas. |

### Limpar o banco local

```bash
docker compose down -v      # apaga containers E dados (volume postgres_data)
docker compose up -d db mailpit && npm run migration:run
```

Para apagar só votações e edições, **mantendo os inscritos**:

```bash
docker compose exec db sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "TRUNCATE edition_observations, newsletter_editions, votes, votings, parliamentarians;"'
```

### Testar do zero: roteiro com várias edições

Cada `digest:send` junta **todas** as votações ainda não enviadas em **uma** edição. Para ter várias edições, alterne ingestão e envio:

```bash
# 0. (opcional) IA simulada, para não gastar cota: no .env, AI_OBSERVATIONS_MODE=mock
#    Para testar a IA de verdade: AI_OBSERVATIONS_MODE=live

npm run db:seed                              # dados reais recentes
npm run digest:send                          # edição 1

npm run ingest -- 2026-05-27 2026-05-27      # um dia específico (ex.: PEC 221 na Câmara)
npm run digest:send                          # edição 2

npm run ingest -- 2026-10-14 2026-10-14      # outro dia (ex.: PEC 221 no Senado)
npm run digest:send                          # edição 3
```

- **Sem inscritos confirmados**, nenhum e-mail sai, mas cada edição fica registrada no arquivo público (http://localhost:3000/arquivo) com "0 enviados". É o jeito mais simples de ver como os e-mails ficariam.
- **Com inscritos**, eles recebem: no Mailpit, ou no e-mail real, se o `.env` estiver com Gmail (passo 8).
- **Com `live`**, cada edição chama as IAs. O plano gratuito do Groq tem cota diária: depois de alguns testes, quem escreve são as IAs reserva da NVIDIA ou o resumo automático. Os logs do `digest:send` mostram quem escreveu cada observação.

---

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run db:seed` | Popula o banco local com 2 votações reais recentes de cada casa. |
| `npm run ingest -- AAAA-MM-DD AAAA-MM-DD` | Busca votações de um período (backfill). |
| `npm run digest:send` | Envia agora a edição pendente (mesma rotina do cron das 5h). |
| `npm run digest:send -- --retry` | Só retoma envios pendentes. |
| `npm test` | Testes unitários. |
| `npm run migration:generate --name=Nome` | Gera migration a partir das entidades. |

## Agendamentos (fuso America/Sao_Paulo, configuráveis no `.env`)

| Variável | Padrão | Job |
|---|---|---|
| `INGESTION_CRON` | `0 18,23 * * *` | Busca leis, votos e ausências (à noite). |
| `DIGEST_CRON` | `0 5 * * *` | Envio do resumo diário. |
| `DIGEST_RETRY_CRON` | `*/15 5-17 * * *` | Retomada de envios com falha temporária. |
| — | de hora em hora | Apaga inscrições não confirmadas e expiradas. |

---

## API pública (somente leitura)

| Rota | Descrição |
|---|---|
| `GET /api/votings?q=&chamber=&from=&to=&page=&limit=` | Votações, com busca sem acento. |
| `GET /api/votings/:id` | Votação com o voto de cada parlamentar. |
| `GET /api/parliamentarians?q=&chamber=&party=&state=` | Busca de parlamentares. |
| `GET /api/parliamentarians/:id` e `/:id/votes` | Perfil e histórico de votos. |
| `GET /api/parliamentarians/absences?chamber=&from=&to=` | Ranking de quem não votou. |
| `GET /api/editions?q=&chamber=&from=&to=` | Arquivo de e-mails enviados. |
| `GET /api/editions/:id` e `/:id/email` | Detalhe da edição e o e-mail como foi enviado. |
| `POST /api/subscriptions` | Inscrição (`{ email, acceptedTerms: true }`). |
| `POST /api/subscriptions/confirm` / `unsubscribe` | Confirmação e cancelamento (`{ token }`). |
| `POST /api/subscriptions/one-click-unsubscribe?token=` | Cancelamento em um clique (RFC 8058). |

---

## Antes de ir para produção

- Usar um provedor SMTP com SPF, DKIM e DMARC configurados no domínio. Sem isso, os resumos caem no spam.
- Guardar os segredos (`UNSUBSCRIBE_TOKEN_SECRET`, `DB_PASSWORD`, `MAIL_PASSWORD`) no Azure Key Vault ou no Google Secret Manager, e não em `.env`.
- Configurar `TRUST_PROXY_HOPS` de acordo com o load balancer, senão o rate limit enxerga o IP do proxy.
- Rodar `npm audit` no CI.
