/**
 * addToCart — shopping cart operations for the Farm Rio ChatGPT widget.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/OrderItem   — CartItem
 *   @see https://schema.org/Order       — Cart (pre-purchase cart modelled as Order)
 *   @see https://schema.org/PriceSpecification — cartTotals return value
 *   @see https://schema.org/QuantitativeValue  — quantity / delta fields
 */
import { z } from "zod";
import type { Product } from "../data/products.js";
import { getProductById } from "../lib/farmRioLive.js";
import {
  addRealCartItem,
  removeRealCartItem,
  type RealCart,
  type RealCartItem,
  type RealCartTotals,
  updateRealCartItemQuantity,
  viewRealCart,
} from "../lib/farmRioCheckout.js";

/** @see https://schema.org/OrderItem */
export type CartItem = RealCartItem;

/** @see https://schema.org/Order (pre-purchase shopping cart) */
export type Cart = RealCart;

/**
 * Compute price breakdown for a cart.
 * @see https://schema.org/PriceSpecification
 * @see https://schema.org/UnitPriceSpecification
 */
export function cartTotals(cart: Cart) {
  const subtotal = cart.items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );
  const couponSavings = subtotal * (cart.couponDiscount ?? 0);
  const vendorSavings = subtotal * (cart.vendorDiscount ?? 0);
  const shipping = cart.shippingCost ?? 0;
  const total = subtotal - couponSavings - vendorSavings + shipping;
  return { subtotal, couponSavings, vendorSavings, shipping, total };
}

export type CartTotals = RealCartTotals;

// ─── Add to cart ───────────────────────────────────────────────────────────

export const addToCartInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "Identificador da sessão do carrinho." },
    productId: { type: "string", description: "ID do produto a adicionar." },
    size: { type: "string", description: "Tamanho selecionado (ex: M, G, 38)." },
    quantity: { type: "number", description: "Quantidade. Padrão: 1." },
  },
  required: ["sessionId", "productId", "size"],
  additionalProperties: false,
} as const;

export const addToCartInputParser = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export async function handleAddToCart(raw: unknown) {
  const args = addToCartInputParser.parse(raw);
  const product = await getProductById(args.productId);

  if (!product) {
    return {
      content: [{ type: "text" as const, text: `Produto "${args.productId}" não encontrado.` }],
      structuredContent: { view: "cart-error", error: "product_not_found" },
    };
  }

  if (product.sizes.length > 0 && !product.sizes.includes(args.size)) {
    return {
      content: [{ type: "text" as const, text: `O tamanho "${args.size}" não está disponível para "${product.name}".` }],
      structuredContent: { view: "cart-error", error: "invalid_size" },
    };
  }

  const { cart, totals, messages } = await addRealCartItem(
    args.sessionId,
    product,
    args.size,
    args.quantity
  );

  return {
    content: [
      {
        type: "text" as const,
        text:
          messages[0] ??
          `"${product.name}" (${args.size}) adicionado ao carrinho. Total: R$ ${totals.total.toFixed(2)}`,
      },
    ],
    structuredContent: {
      view: "cart",
      message:
        messages[0] ??
        `"${product.name}" (${args.size}) adicionado ao carrinho.`,
      cart,
      totals,
    },
  };
}

// ─── Remove from cart ──────────────────────────────────────────────────────

export const removeFromCartInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "Identificador da sessão do carrinho." },
    productId: { type: "string", description: "ID do produto a remover." },
    size: { type: "string", description: "Tamanho do item a remover." },
  },
  required: ["sessionId", "productId", "size"],
  additionalProperties: false,
} as const;

export const removeFromCartInputParser = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  size: z.string().min(1),
});

export async function handleRemoveFromCart(raw: unknown) {
  const args = removeFromCartInputParser.parse(raw);
  const currentCartState = await viewRealCart(args.sessionId);
  const existing = currentCartState.cart.items.find(
    (item) => item.product.id === args.productId && item.size === args.size
  );

  if (!existing) {
    return {
      content: [{ type: "text" as const, text: "Item não encontrado no carrinho." }],
      structuredContent: {
        view: "cart",
        cart: currentCartState.cart,
        totals: currentCartState.totals,
      },
    };
  }

  const { cart, totals, messages } = await removeRealCartItem(
    args.sessionId,
    existing.product.sku
  );

  return {
    content: [
      {
        type: "text" as const,
        text: messages[0] ?? `Item removido. Total: R$ ${totals.total.toFixed(2)}`,
      },
    ],
    structuredContent: {
      view: "cart",
      message: messages[0] ?? "Item removido do carrinho.",
      cart,
      totals,
    },
  };
}

// ─── View cart ─────────────────────────────────────────────────────────────

export const viewCartInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "Identificador da sessão do carrinho." },
  },
  required: ["sessionId"],
  additionalProperties: false,
} as const;

export const viewCartInputParser = z.object({ sessionId: z.string().min(1) });

export async function handleViewCart(raw: unknown) {
  const args = viewCartInputParser.parse(raw);
  const { cart, totals } = await viewRealCart(args.sessionId);

  return {
    content: [
      {
        type: "text" as const,
        text:
          cart.items.length === 0
            ? "Seu carrinho está vazio."
            : `Carrinho com ${cart.items.length} item(s). Total: R$ ${totals.total.toFixed(2)}`,
      },
    ],
    structuredContent: {
      view: "cart",
      message: cart.items.length === 0 ? "Seu carrinho está vazio." : undefined,
      cart,
      totals,
    },
  };
}

// ─── Update item quantity ──────────────────────────────────────────────────

/**
 * Update item quantity by a relative delta (+1 / -1 / etc.).
 * Items whose resulting quantity drops to ≤ 0 are removed automatically.
 *
 * @see https://schema.org/QuantitativeValue
 */
export const updateItemQuantityInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "Identificador da sessão do carrinho." },
    productId: { type: "string", description: "ID do produto." },
    size: { type: "string", description: "Tamanho do item." },
    delta: {
      type: "number",
      description: "Variação de quantidade: +1 para adicionar, -1 para reduzir. Se o resultado for ≤ 0, o item é removido.",
    },
  },
  required: ["sessionId", "productId", "size", "delta"],
  additionalProperties: false,
} as const;

export const updateItemQuantityInputParser = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  size: z.string().min(1),
  delta: z.number().int(),
});

export async function handleUpdateItemQuantity(raw: unknown) {
  const args = updateItemQuantityInputParser.parse(raw);
  const currentCartState = await viewRealCart(args.sessionId);
  const currentCart = currentCartState.cart;

  const existing = currentCart.items.find(
    (item) => item.product.id === args.productId && item.size === args.size
  );

  if (!existing) {
    return {
      content: [{ type: "text" as const, text: "Item não encontrado no carrinho." }],
      structuredContent: {
        view: "cart",
        message: "Item não encontrado no carrinho.",
        cart: currentCart,
        totals: currentCartState.totals,
      },
    };
  }

  const newQty = existing.quantity + args.delta;

  const { cart, totals, messages } = await updateRealCartItemQuantity(
    args.sessionId,
    existing.product.sku,
    newQty
  );

  return {
    content: [
      {
        type: "text" as const,
        text:
          messages[0] ??
          (newQty <= 0
            ? `Item removido. Total: R$ ${totals.total.toFixed(2)}`
            : `Quantidade atualizada para ${newQty}. Total: R$ ${totals.total.toFixed(2)}`),
      },
    ],
    structuredContent: {
      view: "cart",
      message:
        messages[0] ??
        (newQty <= 0 ? "Item removido do carrinho." : `Quantidade atualizada para ${newQty}.`),
      cart,
      totals,
    },
  };
}
