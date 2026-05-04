/**
 * Farm Rio Conversational Ecommerce MCP Server
 *
 * Exposes tools for searching, browsing, and purchasing Farm Rio products
 * with a rich UI widget rendered inside ChatGPT.
 *
 * Endpoints:
 *   POST   /mcp — Streamable HTTP (MCP connection + messages)
 *   GET    /mcp — SSE resumption (optional, for clients that need it)
 *   DELETE /mcp — Close session
 *
 * Tools:
 *   search_products        — Full-text + intent search
 *   get_product            — Product detail
 *   list_categories        — Browse product categories
 *   get_suggestions        — Search autocomplete / type-ahead
 *   get_top_searches       — Trending search terms
 *   add_to_cart            — Add item to the live VTEX orderForm cart
 *   remove_from_cart       — Remove item from cart
 *   update_item_quantity   — Change quantity of a cart item
 *   view_cart              — View current cart
 *   add_to_wishlist        — Save product to wishlist
 *   view_wishlist          — View saved wishlist
 *   remove_from_wishlist   — Remove from wishlist
 *   apply_coupon           — Apply discount coupon
 *   apply_vendor_code      — Apply vendor/influencer code
 *   check_shipping         — Calculate shipping by CEP
 *   recommend_outfit       — Get outfit recommendations
 *   get_order_history      — View past orders
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { searchProductsInputSchema, handleSearchProducts } from "./tools/searchProducts.js";
import { getProductInputSchema, handleGetProduct } from "./tools/getProduct.js";
import { listCategoriesInputSchema, handleListCategories } from "./tools/listCategories.js";
import { getSuggestionsInputSchema, handleGetSuggestions } from "./tools/getSuggestions.js";
import { getTopSearchesInputSchema, handleGetTopSearches } from "./tools/getTopSearches.js";
import {
  addToCartInputSchema,
  removeFromCartInputSchema,
  viewCartInputSchema,
  updateItemQuantityInputSchema,
  handleAddToCart,
  handleRemoveFromCart,
  handleViewCart,
  handleUpdateItemQuantity,
} from "./tools/addToCart.js";
import {
  addToWishlistInputSchema,
  viewWishlistInputSchema,
  removeFromWishlistInputSchema,
  handleAddToWishlist,
  handleViewWishlist,
  handleRemoveFromWishlist,
} from "./tools/wishlist.js";
import {
  applyCouponInputSchema,
  applyVendorCodeInputSchema,
  checkShippingInputSchema,
  handleApplyCoupon,
  handleApplyVendorCode,
  handleCheckShipping,
} from "./tools/applyCoupon.js";
import {
  recommendOutfitInputSchema,
  handleRecommendOutfit,
} from "./tools/recommendOutfit.js";
import { getOrderHistoryInputSchema, handleGetOrderHistory } from "./tools/getOrderHistory.js";
import {
  ANALYTICS_LOG_PATH,
  recordCartSnapshot,
  recordToolAnalytics,
  recordWishlistSnapshot,
} from "./lib/analytics.js";
import { SESSION_STORE_PATH } from "./lib/sessionStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ASSETS_DIR = path.resolve(ROOT_DIR, "assets");

const WIDGET_NAME = "ecommerce-shop";
const WIDGET_URI = "ui://widget/ecommerce-shop.html";
const MIME_TYPE = "text/html;profile=mcp-app";
const SERVER_NAME = "farm-rio-ecommerce";
const SERVER_VERSION = "1.0.0";
const widgetCspDomains = {
  connectDomains: [] as string[],
  resourceDomains: [
    "https://lojafarm.vteximg.com.br",
    "https://lojafarm.vtexassets.com",
    "https://images.unsplash.com",
    "https://www.farmrio.com.br",
  ],
};

function readWidgetHtml(): string {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Widget assets not found. Expected: ${ASSETS_DIR}. Run "pnpm run build" first.`
    );
  }

  const directPath = path.join(ASSETS_DIR, `${WIDGET_NAME}.html`);
  if (fs.existsSync(directPath)) {
    return fs.readFileSync(directPath, "utf8");
  }

  // fallback to hash-named file
  const candidates = fs
    .readdirSync(ASSETS_DIR)
    .filter((f) => f.startsWith(`${WIDGET_NAME}-`) && f.endsWith(".html"))
    .sort();

  const fallback = candidates[candidates.length - 1];
  if (fallback) {
    return fs.readFileSync(path.join(ASSETS_DIR, fallback), "utf8");
  }

  throw new Error(
    `Widget HTML for "${WIDGET_NAME}" not found in ${ASSETS_DIR}. Run "pnpm run build".`
  );
}

const widgetHtml = readWidgetHtml();

function descriptorMeta() {
  return {
    "ui/resourceUri": WIDGET_URI,
    ui: {
      resourceUri: WIDGET_URI,
    },
    "openai/toolInvocation/invoking": "Abrindo a Farm Rio…",
    "openai/toolInvocation/invoked": "Widget Farm Rio pronto",
    "openai/widgetAccessible": true,
  } as const;
}

// Cast helper: SDK v1.x requires mutable string[] in inputSchema.required,
// but our schemas use `as const` which produces readonly arrays.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toInputSchema = (s: unknown): Tool["inputSchema"] => s as any;

const tools: Tool[] = [
  {
    name: "search_products",
    title: "Buscar Produtos Farm Rio",
    description:
      "Busca produtos Farm Rio por texto livre, intenção ou categoria. Suporta linguagem natural como 'vestido floral para festa', 'look casual de verão', 'algo mais barato'.",
    inputSchema: toInputSchema(searchProductsInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "get_product",
    title: "Ver Detalhe do Produto",
    description: "Exibe detalhes completos de um produto: descrição, medidas, fotos, parcelamento.",
    inputSchema: toInputSchema(getProductInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "list_categories",
    title: "Listar Categorias",
    description: "Lista as categorias reais disponíveis na Farm Rio via VTEX taxonomy.",
    inputSchema: toInputSchema(listCategoriesInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "get_suggestions",
    title: "Sugestões de Busca",
    description: "Retorna sugestões de busca (autocomplete) baseadas no texto parcial digitado. Inspirado no VTEX intelligentSearch/suggestions.",
    inputSchema: toInputSchema(getSuggestionsInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "get_top_searches",
    title: "Tendências de Busca",
    description: "Retorna os termos mais buscados e tendências da loja. Inspirado no VTEX intelligentSearch/topsearches.",
    inputSchema: toInputSchema(getTopSearchesInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "add_to_cart",
    title: "Adicionar ao Carrinho",
    description: "Adiciona um produto ao carrinho de compras com tamanho e quantidade.",
    inputSchema: toInputSchema(addToCartInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
  },
  {
    name: "remove_from_cart",
    title: "Remover do Carrinho",
    description: "Remove um item do carrinho de compras.",
    inputSchema: toInputSchema(removeFromCartInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
  },
  {
    name: "update_item_quantity",
    title: "Atualizar Quantidade no Carrinho",
    description: "Altera a quantidade de um item no carrinho via delta relativo (+1 para adicionar, -1 para reduzir). Se o resultado for ≤ 0, o item é removido automaticamente. Inspirado no VTEX actions/cart/updateItems.",
    inputSchema: toInputSchema(updateItemQuantityInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
  },
  {
    name: "view_cart",
    title: "Ver Carrinho",
    description: "Exibe o carrinho de compras atual com totais, descontos e frete.",
    inputSchema: toInputSchema(viewCartInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "add_to_wishlist",
    title: "Salvar na Lista de Desejos",
    description: "Salva um produto na lista de desejos da sessão. Inspirado no VTEX actions/wishlist.",
    inputSchema: toInputSchema(addToWishlistInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
  },
  {
    name: "view_wishlist",
    title: "Ver Lista de Desejos",
    description: "Exibe os produtos salvos na lista de desejos. Inspirado no VTEX loaders/wishlist.",
    inputSchema: toInputSchema(viewWishlistInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "remove_from_wishlist",
    title: "Remover da Lista de Desejos",
    description: "Remove um produto da lista de desejos.",
    inputSchema: toInputSchema(removeFromWishlistInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
  },
  {
    name: "apply_coupon",
    title: "Aplicar Cupom de Desconto",
    description: "Aplica um cupom real ao carrinho VTEX da Farm Rio e devolve o retorno da loja.",
    inputSchema: toInputSchema(applyCouponInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
  },
  {
    name: "apply_vendor_code",
    title: "Aplicar Código de Vendedor",
    description: "Aplica um código promocional real ao checkout VTEX da Farm Rio e devolve o retorno da loja.",
    inputSchema: toInputSchema(applyVendorCodeInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
  },
  {
    name: "check_shipping",
    title: "Calcular Frete por CEP",
    description: "Calcula custo e prazo de entrega para o CEP informado.",
    inputSchema: toInputSchema(checkShippingInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "recommend_outfit",
    title: "Montar Look Completo",
    description: "Sugere peças que combinam com o produto selecionado para um look completo.",
    inputSchema: toInputSchema(recommendOutfitInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
  {
    name: "get_order_history",
    title: "Ver Histórico de Pedidos",
    description: "Exibe os pedidos anteriores do usuário com status, itens e rastreamento. Inspirado no VTEX loaders/orders.",
    inputSchema: toInputSchema(getOrderHistoryInputSchema),
    _meta: descriptorMeta(),
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
];

const resources: Resource[] = [
  {
    uri: WIDGET_URI,
    name: "Farm Rio Ecommerce Shop Widget",
    description: "Widget interativo para navegação e compra de produtos Farm Rio.",
    mimeType: MIME_TYPE,
    _meta: descriptorMeta(),
  },
];

const resourceTemplates: ResourceTemplate[] = [
  {
    uriTemplate: WIDGET_URI,
    name: "Farm Rio Ecommerce Shop Widget",
    description: "Widget interativo Farm Rio.",
    mimeType: MIME_TYPE,
    _meta: descriptorMeta(),
  },
];

function createEcommerceServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { resources: {}, tools: {} } }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_req: ListResourcesRequest) => ({ resources })
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (_req: ReadResourceRequest) => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ...descriptorMeta(),
            ui: {
              resourceUri: WIDGET_URI,
              csp: {
                connectDomains: widgetCspDomains.connectDomains,
                resourceDomains: widgetCspDomains.resourceDomains,
              },
            },
          },
        },
      ],
    })
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (_req: ListResourceTemplatesRequest) => ({ resourceTemplates })
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_req: ListToolsRequest) => ({ tools })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const meta = descriptorMeta();
      const result = await executeToolCall(request.params.name, request.params.arguments ?? {});

      return {
        ...result,
        _meta: {
          ...meta,
          "openai/toolInvocation/invoking": meta["openai/toolInvocation/invoking"],
          "openai/toolInvocation/invoked": meta["openai/toolInvocation/invoked"],
        },
      };
    }
  );

  return server;
}

export async function executeToolCall(toolName: string, args: Record<string, unknown>) {
  const sessionId = typeof args.sessionId === "string" ? args.sessionId : undefined;
  const startedAt = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;

  try {
    switch (toolName) {
      case "search_products":
        result = await handleSearchProducts(args);
        break;
      case "get_product":
        result = await handleGetProduct(args);
        break;
      case "add_to_cart":
        result = await handleAddToCart(args);
        break;
      case "remove_from_cart":
        result = await handleRemoveFromCart(args);
        break;
      case "view_cart":
        result = await handleViewCart(args);
        break;
      case "apply_coupon":
        result = await handleApplyCoupon(args);
        break;
      case "apply_vendor_code":
        result = await handleApplyVendorCode(args);
        break;
      case "check_shipping":
        result = await handleCheckShipping(args);
        break;
      case "recommend_outfit":
        result = await handleRecommendOutfit(args);
        break;
      case "list_categories":
        result = await handleListCategories(args);
        break;
      case "get_suggestions":
        result = await handleGetSuggestions(args);
        break;
      case "get_top_searches":
        result = await handleGetTopSearches(args);
        break;
      case "update_item_quantity":
        result = await handleUpdateItemQuantity(args);
        break;
      case "add_to_wishlist":
        result = await handleAddToWishlist(args);
        break;
      case "view_wishlist":
        result = await handleViewWishlist(args);
        break;
      case "remove_from_wishlist":
        result = await handleRemoveFromWishlist(args);
        break;
      case "get_order_history":
        result = await handleGetOrderHistory(args);
        break;
      default:
        throw new Error(`Ferramenta desconhecida: ${toolName}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    recordToolAnalytics({
      toolName,
      sessionId,
      latencyMs: Date.now() - startedAt,
      success: false,
      args,
      error: message,
    });

    throw error;
  }

  const view = result?.structuredContent?.view;
  recordToolAnalytics({
    toolName,
    sessionId,
    latencyMs: Date.now() - startedAt,
    success: true,
    view,
    args,
  });

  if (result?.structuredContent?.cart && result?.structuredContent?.totals) {
    recordCartSnapshot({
      sessionId,
      toolName,
      itemCount: result.structuredContent.cart.items.reduce(
        (total: number, item: { quantity: number }) => total + item.quantity,
        0
      ),
      subtotal: result.structuredContent.totals.subtotal,
      total: result.structuredContent.totals.total,
      couponCode: result.structuredContent.cart.couponCode,
      vendorCode: result.structuredContent.cart.vendorCode,
    });
  }

  if (result?.structuredContent?.wishlist) {
    recordWishlistSnapshot({
      sessionId,
      toolName,
      itemCount: result.structuredContent.wishlist.length,
    });
  }

  return result;
}

// ─── HTTP / Streamable HTTP server ────────────────────────────────────────

type SessionRecord = { server: Server; transport: StreamableHTTPServerTransport };
const sessions = new Map<string, SessionRecord>();

const mcpPath = "/mcp";

function writeJsonResponse(
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function serviceStatusPayload() {
  return {
    ok: true,
    service: SERVER_NAME,
    version: SERVER_VERSION,
    uptimeSeconds: Math.round(process.uptime()),
    widget: {
      name: WIDGET_NAME,
      uri: WIDGET_URI,
      loaded: widgetHtml.length > 0,
    },
    mcp: {
      mcpPath,
      activeSessions: sessions.size,
    },
    storage: {
      sessionStorePath: SESSION_STORE_PATH,
      analyticsLogPath: ANALYTICS_LOG_PATH,
      dataDirOverride: process.env.ECOMMERCE_DATA_DIR?.trim() || null,
    },
    timestamp: new Date().toISOString(),
  };
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id");

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let record = sessionId ? sessions.get(sessionId) : undefined;

  if (!record) {
    // New session
    const server = createEcommerceServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport });
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
      void server.close();
    };

    transport.onerror = (err) => {
      console.error("[MCP transport error]", err);
    };

    try {
      await server.connect(transport);
    } catch (err) {
      console.error("[MCP connect error]", err);
      if (!res.headersSent) res.writeHead(500).end("Failed to connect MCP server");
      return;
    }

    record = { server, transport };
  }

  try {
    await record.transport.handleRequest(req, res);
  } catch (err) {
    console.error("[MCP handleRequest error]", err);
    if (!res.headersSent) res.writeHead(500).end("MCP request failed");
  }
}

const port = Number(process.env.PORT ?? 8000);
let shutdownInProgress = false;

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === mcpPath) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
    });
    res.end();
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/healthz") {
    if (req.method === "HEAD") {
      res.writeHead(200, { "cache-control": "no-store" });
      res.end();
      return;
    }

    writeJsonResponse(res, 200, serviceStatusPayload());
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    writeJsonResponse(res, 200, {
      ...serviceStatusPayload(),
      documentation: {
        healthcheck: "/healthz",
        mcpUrl: mcpPath,
      },
    });
    return;
  }

  // Streamable HTTP MCP: POST (new msg / new session), GET (SSE resumption), DELETE (close)
  if (
    (req.method === "POST" || req.method === "GET" || req.method === "DELETE") &&
    url.pathname === mcpPath
  ) {
    await handleMcpRequest(req, res);
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.on("clientError", (err: Error, socket) => {
  console.error("[HTTP clientError]", err);
  socket.destroy();
});

export function startHttpServer(listenPort = port) {
  httpServer.listen(listenPort, () => {
    console.log(`🌺 Farm Rio Ecommerce MCP Server`);
    console.log(`   MCP endpoint : http://localhost:${listenPort}${mcpPath}`);
    console.log(`   Healthcheck  : http://localhost:${listenPort}/healthz`);
    console.log(`   Session store: ${path.relative(ROOT_DIR, SESSION_STORE_PATH)}`);
    console.log(`   Analytics log: ${path.relative(ROOT_DIR, ANALYTICS_LOG_PATH)}`);
  });

  return httpServer;
}

export async function stopHttpServer() {
  if (!httpServer.listening) {
    return;
  }

  await Promise.all(
    Array.from(sessions.values()).map(async ({ server }) => {
      try {
        await server.close();
      } catch (error) {
        console.error("[shutdown] failed to close MCP session", error);
      }
    })
  );
  sessions.clear();

  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function shutdown(signal: NodeJS.Signals) {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  console.log(`[shutdown] received ${signal}; closing MCP server`);

  try {
    await stopHttpServer();
    process.exit(0);
  } catch (error) {
    console.error("[shutdown] failed to close cleanly", error);
    process.exit(1);
  }
}

const isMainModule = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isMainModule) {
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  startHttpServer();
}
