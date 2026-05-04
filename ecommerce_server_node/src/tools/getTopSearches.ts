/**
 * getTopSearches — trending search terms with trend direction.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/SearchAction  — top searches as trending SearchAction entries
 *   @see https://schema.org/ItemList      — the ordered list of trending terms
 */
import { getLiveTopSearches } from "../lib/farmRioLive.js";

export const getTopSearchesInputSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

export async function handleGetTopSearches(_raw?: unknown) {
  const topSearches = await getLiveTopSearches(10);

  return {
    content: [
      {
        type: "text" as const,
        text: `Top ${topSearches.length} buscas em alta: ${topSearches.slice(0, 5).map((s) => s.term).join(", ")}.`,
      },
    ],
    structuredContent: {
      view: "top-searches",
      topSearches,
    },
  };
}
