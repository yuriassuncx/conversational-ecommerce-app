/**
 * searchProducts — full-text + intent product search.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/SearchAction   — this tool represents a SearchAction
 *   @see https://schema.org/ItemList       — structured result (list of Products)
 *   @see https://schema.org/Product        — each item in the result list
 */
import { z } from "zod";
import { searchLiveProducts } from "../lib/farmRioLive.js";

export const searchProductsInputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description:
        "Busca em linguagem natural. Ex: 'vestido floral para festa', 'look casual de verão', 'mais barato', 'tem longo?'",
    },
    category: {
      type: "string",
      enum: ["vestido", "blusa", "saia", "calça", "macacão", "acessório", "conjunto"],
      description: "Filtrar por categoria de produto.",
    },
    maxPrice: {
      type: "number",
      description: "Preço máximo em BRL.",
    },
    minPrice: {
      type: "number",
      description: "Preço mínimo em BRL.",
    },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

export const searchProductsInputParser = z.object({
  query: z.string().min(1),
  category: z
    .enum(["vestido", "blusa", "saia", "calça", "macacão", "acessório", "conjunto"])
    .optional(),
  maxPrice: z.number().positive().optional(),
  minPrice: z.number().positive().optional(),
});

export async function handleSearchProducts(raw: unknown) {
  const args = searchProductsInputParser.parse(raw);
  const products = await searchLiveProducts({
    query: args.query,
    category: args.category,
    maxPrice: args.maxPrice,
    minPrice: args.minPrice,
  });

  return {
    content: [
      {
        type: "text" as const,
        text:
          products.length > 0
            ? `Encontrei ${products.length} produto(s) para "${args.query}".`
            : `Nenhum produto encontrado para "${args.query}" no catálogo real da Farm Rio.`,
      },
    ],
    /**
     * Structured output conforms to schema.org/ItemList with schema.org/Product items.
     * @see https://schema.org/ItemList
     */
    structuredContent: {
      view: "product-list",
      products,
      query: args.query,
      totalFound: products.length,
    },
  };
}
