# Deploy no Render.com (free tier)

## Pré-requisitos

- Conta gratuita em https://render.com
- Repositório no GitHub com este código

## Deploy em 5 minutos

### 1. Envie o código para o GitHub

```bash
git init
git add .
git commit -m "chore: farm rio ecommerce mcp server"
git remote add origin https://github.com/<seu-usuario>/<seu-repo>.git
git push -u origin main
```

### 2. Crie o serviço no Render

**Opção A — Via render.yaml (recomendado)**

1. Acesse https://render.com/dashboard
2. Clique em **New → Blueprint**
3. Conecte seu repositório GitHub
4. O Render detecta o `render.yaml` automaticamente
5. Clique em **Apply** — o build e deploy iniciam

**Opção B — Manual**

1. Acesse https://render.com/dashboard
2. Clique em **New → Web Service**
3. Conecte seu repositório GitHub
4. Configure:
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: Free
   - **Region**: Oregon (US West)
5. Adicione as variáveis de ambiente (ver abaixo)
6. Clique em **Create Web Service**

### 3. Variáveis de ambiente

Configure no painel do Render (`Settings → Environment`):

| Variável                 | Valor                        |
| ------------------------ | ---------------------------- |
| `NODE_ENV`               | `production`                 |
| `PORT`                   | `10000`                      |
| `FARM_RIO_VTEX_BASE_URL` | `https://www.farmrio.com.br` |
| `ECOMMERCE_DATA_DIR`     | `/data`                      |

### 4. Aguardar o primeiro deploy

O build demora ~3-5 minutos. Acompanhe em **Logs**.

Quando aparecer:

```
🌺 Farm Rio Ecommerce MCP Server
   SSE endpoint : https://<seu-app>.onrender.com/mcp
```

O serviço está no ar.

## URL do MCP

Após o deploy, a URL MCP será:

```
https://<nome-do-serviço>.onrender.com/mcp
```

Use esta URL como `MCP Server URL` no OpenAI SDK ou cliente MCP.

## Healthcheck

```bash
curl https://<nome-do-serviço>.onrender.com/healthz
# {"ok":true,"service":"farm-rio-ecommerce","version":"1.0.0",...}
```

## Notas sobre o free tier

- **Cold start**: O serviço "adormece" após 15 min sem tráfego. A primeira
  requisição acorda em ~30s.
- **Memória**: 512 MB (suficiente para o servidor)
- **Disco**: Efêmero — o arquivo `.data/` é perdido no restart. Para
  persistência, use um Render Disk ($1/mês) montado em `/data` ou configure
  `ECOMMERCE_DATA_DIR` para um volume.
- **Banda**: 100 GB/mês (gratuito)

## Adicionar disco persistente (opcional)

Para persistir sessões e analytics entre restarts:

1. No painel do serviço → **Disks → Add Disk**
2. Configure:
   - **Name**: `ecommerce-data`
   - **Mount Path**: `/data`
   - **Size**: 1 GB ($1/mês)
3. A variável `ECOMMERCE_DATA_DIR=/data` já aponta para o disco

## Redeploy

Qualquer `git push` para `main` dispara redeploy automático (se Auto-Deploy
estiver ativo).

Para redeploy manual: Dashboard → **Manual Deploy → Deploy latest commit**
