# Deploy na Railway

Este servidor MCP ja esta preparado para subir na Railway sem ngrok.

## O que ja foi preparado

- O servidor expõe `GET /mcp` e `POST /mcp/messages`.
- Healthcheck público em `GET /healthz`.
- Rota raiz `GET /` com status e endpoints do serviço.
- Shutdown gracioso para deploy/restart da Railway.
- `ECOMMERCE_DATA_DIR` opcional para persistir `.data` em volume.
- `Dockerfile` no root do monorepo para buildar o widget `ecommerce-shop` e
  iniciar o MCP server.

## URL MCP pública

Depois do deploy, use:

`https://SEU-DOMINIO-RAILWAY/mcp`

Essa é a URL global do MCP. O handshake SSE acontece em `/mcp` e o servidor usa
internamente `/mcp/messages` para o canal de POST.

## Configuração recomendada na Railway

Crie um novo serviço a partir do repositório inteiro, usando o `Dockerfile` da
raiz.

Configuração recomendada:

1. Root directory: vazio, usar a raiz do monorepo.
2. Builder: Dockerfile.
3. Healthcheck path: `/healthz`.
4. Start command: deixar o `CMD` do Dockerfile.
5. Replicas: `1`.

Use uma réplica só nesta fase. O transporte MCP atual mantém sessões SSE em
memória; múltiplas réplicas sem sticky session podem quebrar sessões em
andamento.

## Variáveis de ambiente

Obrigatórias:

1. `PORT`: a Railway injeta automaticamente.

Opcionais:

1. `FARM_RIO_VTEX_BASE_URL=https://www.farmrio.com.br`
2. `ECOMMERCE_DATA_DIR=/data`

## Persistência recomendada

Por padrão, sessões e analytics são gravados em `.data` dentro do container.
Isso funciona, mas é efêmero.

Para não perder carrinho e analytics após restart/deploy:

1. Adicione um volume na Railway.
2. Monte o volume em `/data`.
3. Configure `ECOMMERCE_DATA_DIR=/data`.

Arquivos persistidos:

1. `commerce-sessions.json`
2. `analytics-events.jsonl`

## Build e execução local equivalentes

Na raiz do monorepo:

```bash
pnpm install --frozen-lockfile
pnpm run deploy:railway:build
pnpm run deploy:railway:start
```

## Verificações após subir

1. Abrir `https://SEU-DOMINIO-RAILWAY/healthz`
2. Confirmar retorno `ok: true`
3. Abrir `https://SEU-DOMINIO-RAILWAY/mcp`
4. Validar que o cliente MCP consegue conectar usando essa URL

## Observações operacionais

1. O widget `ecommerce-shop` é buildado no deploy e servido pelo próprio MCP
   server a partir dos assets gerados.
2. O histórico de pedidos real da VTEX continua dependente de autenticação da
   loja; sem autenticação, a resposta permanece vazia por design.
3. Se depois vocês quiserem escalar horizontalmente, o próximo passo é tirar
   sessão/analytics do filesystem e mover para Redis ou Postgres.
