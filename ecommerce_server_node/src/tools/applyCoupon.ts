/**
 * applyCoupon — discount coupons, vendor codes, and shipping calculation.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/Offer                    — coupon / vendor code as a promotional Offer
 *   @see https://schema.org/PriceSpecification       — price after discount
 *   @see https://schema.org/ParcelDelivery          — shipping result
 *   @see https://schema.org/DeliveryChargeSpecification — shipping cost
 *   @see https://schema.org/estimatedDeliveryTime   — shipping estimate string
 */
import { z } from "zod";
import {
  applyRealCouponCode,
  applyRealShippingPostalCode,
  applyRealVendorCode,
  viewRealCart,
} from "../lib/farmRioCheckout.js";

// ─── Apply coupon ──────────────────────────────────────────────────────────

export const applyCouponInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "Identificador da sessão do carrinho." },
    couponCode: { type: "string", description: "Código do cupom (ex: FARM10, FARM20, PRIMEIRA)." },
  },
  required: ["sessionId", "couponCode"],
  additionalProperties: false,
} as const;

export const applyCouponInputParser = z.object({
  sessionId: z.string().min(1),
  couponCode: z.string().min(1),
});

export async function handleApplyCoupon(raw: unknown) {
  const args = applyCouponInputParser.parse(raw);
  const code = args.couponCode.toUpperCase().trim();
  const { cart, totals, messages } = await applyRealCouponCode(args.sessionId, code);
  const appliedCode = cart.couponCode;
  const primaryMessage = messages[0];

  return {
    content: [
      {
        type: "text" as const,
        text:
          primaryMessage ??
          (appliedCode
            ? `Cupom "${appliedCode}" aplicado. Total: R$ ${totals.total.toFixed(2)}`
            : `Cupom "${code}" não foi aceito pela VTEX da loja.`),
      },
    ],
    structuredContent: {
      view: "cart",
      message: primaryMessage,
      cart,
      totals,
      ...(appliedCode
        ? {
            couponApplied: {
              code: appliedCode,
              discount: totals.subtotal > 0 ? totals.couponSavings / totals.subtotal : 0,
              description: primaryMessage ?? "Cupom aplicado pela VTEX checkout",
            },
          }
        : {
            couponError:
              primaryMessage ?? `Cupom "${code}" não foi aceito pela VTEX checkout da Farm Rio.`,
          }),
    },
  };
}

// ─── Apply vendor code ─────────────────────────────────────────────────────

export const applyVendorCodeInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "Identificador da sessão do carrinho." },
    vendorCode: { type: "string", description: "Código do vendedor ou embaixadora." },
  },
  required: ["sessionId", "vendorCode"],
  additionalProperties: false,
} as const;

export const applyVendorCodeInputParser = z.object({
  sessionId: z.string().min(1),
  vendorCode: z.string().min(1),
});

export async function handleApplyVendorCode(raw: unknown) {
  const args = applyVendorCodeInputParser.parse(raw);
  const code = args.vendorCode.toUpperCase().trim();
  const { cart, totals, messages } = await applyRealVendorCode(args.sessionId, code);
  const appliedCode = cart.couponCode;
  const primaryMessage = messages[0];

  return {
    content: [
      {
        type: "text" as const,
        text:
          primaryMessage ??
          (appliedCode
            ? `Código "${appliedCode}" aplicado pela VTEX checkout. Total: R$ ${totals.total.toFixed(2)}`
            : `Código "${code}" não foi aceito pela VTEX checkout.`),
      },
    ],
    structuredContent: {
      view: "cart",
      message: primaryMessage,
      cart,
      totals,
      ...(appliedCode
        ? {
            vendorApplied: {
              code: appliedCode,
              name: "Código promocional VTEX",
              discount: totals.subtotal > 0 ? totals.couponSavings / totals.subtotal : 0,
              description: primaryMessage ?? "Código aplicado pela VTEX checkout",
            },
          }
        : {
            vendorError:
              primaryMessage ?? `Código "${code}" não foi aceito pela VTEX checkout da Farm Rio.`,
          }),
    },
  };
}

// ─── Check shipping ────────────────────────────────────────────────────────

export const checkShippingInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "Identificador da sessão do carrinho." },
    cep: { type: "string", description: "CEP de entrega (somente números ou com hífen, ex: 01310-100)." },
  },
  required: ["sessionId", "cep"],
  additionalProperties: false,
} as const;

export const checkShippingInputParser = z.object({
  sessionId: z.string().min(1),
  cep: z
    .string()
    .min(8)
    .regex(/^\d{5}-?\d{3}$/, "CEP deve ter formato 00000-000"),
});

export async function handleCheckShipping(raw: unknown) {
  const args = checkShippingInputParser.parse(raw);
  const currentCart = await viewRealCart(args.sessionId);
  if (currentCart.cart.items.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Adicione pelo menos um item ao carrinho para calcular frete real pela VTEX.",
        },
      ],
      structuredContent: {
        view: "cart",
        message: "Adicione pelo menos um item ao carrinho para calcular frete real pela VTEX.",
        cart: currentCart.cart,
        totals: currentCart.totals,
        shippingInfo: undefined,
      },
    };
  }

  const { cart, totals, messages } = await applyRealShippingPostalCode(args.sessionId, args.cep);
  const cost = cart.shippingCost ?? totals.shipping;
  const estimate = cart.shippingEstimate;

  return {
    content: [
      {
        type: "text" as const,
        text:
          messages[0] ??
          (cost === 0
            ? `Frete grátis para o CEP ${args.cep}! ${estimate ?? ""}`.trim()
            : `Frete para ${args.cep}: R$ ${cost.toFixed(2)}${estimate ? ` — ${estimate}` : ""}`),
      },
    ],
    structuredContent: {
      view: "cart",
      message: messages[0],
      cart,
      totals,
      shippingInfo: estimate ? { cep: args.cep, cost, estimate } : undefined,
    },
  };
}
