/**
 * wishlist — save, view, and remove products from the user's wishlist.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/WantAction  — adding a product to the wishlist
 *   @see https://schema.org/Product     — each wishlisted item
 *   @see https://schema.org/ItemList    — the wishlist as a collection
 */
import { z } from "zod";
import type { Product } from "../data/products.js";
import { getProductById, getProductsByIds } from "../lib/farmRioLive.js";
import { getSessionSnapshot, updateSession } from "../lib/sessionStore.js";

function getWishlistIds(sessionId: string): string[] {
  return getSessionSnapshot(sessionId).wishlistProductIds;
}

async function buildWishlistProducts(sessionId: string): Promise<Product[]> {
  return getProductsByIds(getWishlistIds(sessionId));
}

// ─── Add to wishlist ───────────────────────────────────────────────────────

export const addToWishlistInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "ID da sessão." },
    productId: { type: "string", description: "ID do produto a adicionar na lista de desejos." },
  },
  required: ["sessionId", "productId"],
  additionalProperties: false,
} as const;

export const addToWishlistInputParser = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
});

export async function handleAddToWishlist(raw: unknown) {
  const { sessionId, productId } = addToWishlistInputParser.parse(raw);

  const product = await getProductById(productId);
  if (!product) {
    return {
      content: [{ type: "text" as const, text: `Produto "${productId}" não encontrado.` }],
      isError: true,
    };
  }

  const alreadySaved = getWishlistIds(sessionId).includes(productId);

  updateSession(sessionId, (session) => {
    if (!session.wishlistProductIds.includes(productId)) {
      session.wishlistProductIds.push(productId);
    }
  });

  const products = await buildWishlistProducts(sessionId);

  return {
    content: [
      {
        type: "text" as const,
        text: alreadySaved
          ? `"${product.name}" já está na sua lista de desejos.`
          : `"${product.name}" salvo na lista de desejos! ❤️`,
      },
    ],
    structuredContent: {
      view: "wishlist",
      wishlist: products,
      message: alreadySaved
        ? `"${product.name}" já está na sua lista de desejos.`
        : `"${product.name}" salvo na lista de desejos!`,
    },
  };
}

// ─── View wishlist ─────────────────────────────────────────────────────────

export const viewWishlistInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "ID da sessão." },
  },
  required: ["sessionId"],
  additionalProperties: false,
} as const;

export const viewWishlistInputParser = z.object({
  sessionId: z.string().min(1),
});

export async function handleViewWishlist(raw: unknown) {
  const { sessionId } = viewWishlistInputParser.parse(raw);
  const products = await buildWishlistProducts(sessionId);

  return {
    content: [
      {
        type: "text" as const,
        text:
          products.length === 0
            ? "Sua lista de desejos está vazia."
            : `${products.length} produto(s) na lista de desejos.`,
      },
    ],
    structuredContent: {
      view: "wishlist",
      wishlist: products,
    },
  };
}

// ─── Remove from wishlist ──────────────────────────────────────────────────

export const removeFromWishlistInputSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string", description: "ID da sessão." },
    productId: { type: "string", description: "ID do produto a remover da lista de desejos." },
  },
  required: ["sessionId", "productId"],
  additionalProperties: false,
} as const;

export const removeFromWishlistInputParser = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
});

export async function handleRemoveFromWishlist(raw: unknown) {
  const { sessionId, productId } = removeFromWishlistInputParser.parse(raw);

  const product = await getProductById(productId);

  updateSession(sessionId, (session) => {
    session.wishlistProductIds = session.wishlistProductIds.filter((id) => id !== productId);
  });

  const products = await buildWishlistProducts(sessionId);

  return {
    content: [
      {
        type: "text" as const,
        text: product
          ? `"${product.name}" removido da lista de desejos.`
          : "Item removido da lista de desejos.",
      },
    ],
    structuredContent: {
      view: "wishlist",
      wishlist: products,
    },
  };
}
