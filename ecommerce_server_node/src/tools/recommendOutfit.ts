/**
 * recommendOutfit — generate a complete outfit suggestion anchored on a product.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/ItemList    — outfit as an ordered list of Products
 *   @see https://schema.org/isRelatedTo — relationship between anchor and outfit items
 *   @see https://schema.org/Product     — each outfit item
 */
import { z } from "zod";
import { getProductById, recommendProductsForAnchor } from "../lib/farmRioLive.js";

export const recommendOutfitInputSchema = {
  type: "object",
  properties: {
    productId: {
      type: "string",
      description: "ID do produto âncora para gerar sugestões de look completo.",
    },
  },
  required: ["productId"],
  additionalProperties: false,
} as const;

export const recommendOutfitInputParser = z.object({
  productId: z.string().min(1),
});

export async function handleRecommendOutfit(raw: unknown) {
  const args = recommendOutfitInputParser.parse(raw);
  const anchor = await getProductById(args.productId);

  if (!anchor) {
    return {
      content: [{ type: "text" as const, text: `Produto "${args.productId}" não encontrado.` }],
      structuredContent: { view: "product-not-found", productId: args.productId },
    };
  }

  const outfitItems = await recommendProductsForAnchor(anchor, 3);
  const totalOutfitPrice =
    anchor.price + outfitItems.reduce((sum, product) => sum + product.price, 0);

  return {
    content: [
      {
        type: "text" as const,
        text: `Look completo com "${anchor.name}": ${outfitItems.map((product) => product.name).join(", ")}. Total do look: R$ ${totalOutfitPrice.toFixed(2)}`,
      },
    ],
    /**
     * @see https://schema.org/ItemList (outfitItems)
     * @see https://schema.org/isRelatedTo (anchor → outfit items)
     */
    structuredContent: {
      view: "outfit",
      anchor,
      outfitItems,
      totalOutfitPrice,
    },
  };
}
