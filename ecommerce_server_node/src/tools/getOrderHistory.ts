/**
 * getOrderHistory — retrieve real VTEX order history when the store session is authenticated.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/Order         — Order interface
 *   @see https://schema.org/OrderItem     — OrderItem interface
 *   @see https://schema.org/OrderStatus   — order status enum
 *   @see https://schema.org/ParcelDelivery — trackingCode / shipping
 */
import { z } from "zod";

const FARM_RIO_BASE_URL =
  process.env.FARM_RIO_VTEX_BASE_URL?.trim() || "https://www.farmrio.com.br";
const ORDER_HISTORY_URL = new URL("/api/oms/user/orders?page=1", FARM_RIO_BASE_URL);

/** @see https://schema.org/OrderItem */
export interface OrderItem {
  /** @see https://schema.org/orderedItem */
  productId: string;
  /** @see https://schema.org/name */
  productName: string;
  /** Size variant */
  size: string;
  /** @see https://schema.org/orderQuantity */
  quantity: number;
  /** @see https://schema.org/price */
  price: number;
  /** @see https://schema.org/image */
  image: string;
}

/**
 * @see https://schema.org/Order
 * @see https://schema.org/OrderStatus
 */
export interface Order {
  /** @see https://schema.org/orderNumber */
  id: string;
  /** @see https://schema.org/orderDate (ISO 8601) */
  date: string;
  /** @see https://schema.org/orderStatus */
  status: "entregue" | "em_transito" | "processando" | "cancelado";
  statusLabel: string;
  statusColor: "green" | "blue" | "yellow" | "red";
  /** @see https://schema.org/orderedItem */
  items: OrderItem[];
  /** @see https://schema.org/price */
  total: number;
  /** @see https://schema.org/trackingUrl (CORREIOS) */
  trackingCode?: string;
}

export const getOrderHistoryInputSchema = {
  type: "object",
  properties: {
    sessionId: {
      type: "string",
      description: "ID da sessão do usuário.",
    },
  },
  required: ["sessionId"],
  additionalProperties: false,
} as const;

export const getOrderHistoryInputParser = z.object({
  sessionId: z.string().min(1),
});

async function fetchRealOrders(): Promise<{ orders: Order[]; requiresAuth: boolean }> {
  const response = await fetch(ORDER_HISTORY_URL, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (response.status === 401) {
    return { orders: [], requiresAuth: true };
  }

  if (!response.ok) {
    throw new Error(`Farm Rio OMS returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    list?: Array<{
      orderId?: string;
      creationDate?: string;
      status?: string;
      statusDescription?: string;
      packageAttachment?: { packages?: Array<{ trackingNumber?: string }> };
      items?: Array<{
        id?: string;
        name?: string;
        quantity?: number;
        price?: number;
        imageUrl?: string;
      }>;
        value?: number;
    }>;
  };

  const orders: Order[] = (payload.list ?? []).map((order) => {
    const status: Order["status"] = /cancel/iu.test(order.status ?? "")
      ? "cancelado"
      : /transit|route|handling/iu.test(order.status ?? "")
        ? "em_transito"
        : /payment|ready|window|invoiced/iu.test(order.status ?? "")
          ? "processando"
          : "entregue";
    const statusColor: Order["statusColor"] = status === "cancelado"
      ? "red"
      : status === "em_transito"
        ? "blue"
        : status === "processando"
          ? "yellow"
          : "green";

    return {
      id: order.orderId ?? "",
      date: (order.creationDate ?? "").slice(0, 10),
      status,
      statusLabel: order.statusDescription ?? order.status ?? "Pedido",
      statusColor,
      items: (order.items ?? []).map((item) => ({
        productId: String(item.id ?? ""),
        productName: item.name ?? "Produto Farm Rio",
        size: "U",
        quantity: item.quantity ?? 1,
        price: (item.price ?? 0) / 100,
        image: item.imageUrl ?? "",
      })),
      total: (order.value ?? 0) / 100,
      trackingCode: order.packageAttachment?.packages?.[0]?.trackingNumber,
    };
  });

  return { orders, requiresAuth: false };
}

export async function handleGetOrderHistory(raw: unknown) {
  getOrderHistoryInputParser.parse(raw);
  const { orders, requiresAuth } = await fetchRealOrders();

  return {
    content: [
      {
        type: "text" as const,
        text: requiresAuth
          ? "O histórico real da Farm Rio exige autenticação da conta da loja; nenhum pedido foi exposto para esta sessão."
          : orders.length > 0
            ? `${orders.length} pedido(s) real(is) encontrado(s). Pedido mais recente: ${orders[0]?.id}.`
            : "Nenhum pedido real disponível para esta sessão.",
      },
    ],
    structuredContent: {
      view: "orders",
      orders,
    },
  };
}
