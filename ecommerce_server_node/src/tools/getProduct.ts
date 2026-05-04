/**
 * getProduct — fetch full product detail and outfit pairing recommendations.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/Product     — the returned product
 *   @see https://schema.org/Offer       — price / availability
 *   @see https://schema.org/Brand       — product brand
 *   @see https://schema.org/isRelatedTo — outfitPairs relationships
 */
import { z } from "zod";
import { getProductById, recommendProductsForAnchor } from "../lib/farmRioLive.js";

export const getProductInputSchema = {
  type: "object",
  properties: {
    productId: {
      type: "string",
      description: "ID do produto a exibir em detalhe.",
    },
  },
  required: ["productId"],
  additionalProperties: false,
} as const;

export const getProductInputParser = z.object({
  productId: z.string().min(1),
});

export async function handleGetProduct(raw: unknown) {
  const args = getProductInputParser.parse(raw);
  const product = await getProductById(args.productId);

  if (!product) {
    return {
      content: [{ type: "text" as const, text: `Produto "${args.productId}" não encontrado.` }],
      structuredContent: { view: "product-not-found", productId: args.productId },
    };
  }

  // Resolve outfit pairs
  // @see https://schema.org/isRelatedTo
  const outfitPairs = await recommendProductsForAnchor(product, 4);

  return {
    content: [
      {
        type: "text" as const,
        text: `${product.name} — R$ ${product.price.toFixed(2)}`,
      },
    ],
    /**
     * @see https://schema.org/Product
     * @see https://schema.org/isRelatedTo (outfitPairs)
     */
    structuredContent: {
      view: "product-detail",
      product,
      outfitPairs,
    },
  };
}
