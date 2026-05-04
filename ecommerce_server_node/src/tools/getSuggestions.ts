/**
 * getSuggestions — search autocomplete / type-ahead suggestions.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/SearchAction  — this tool fulfils a search intent
 *   @see https://schema.org/EntryPoint   — the suggestions act as query entry points
 */
import { z } from "zod";
import { getLiveSuggestions } from "../lib/farmRioLive.js";

export const getSuggestionsInputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Texto parcial para autocompletar a busca.",
    },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

export const getSuggestionsInputParser = z.object({
  query: z.string().min(1),
});

export async function handleGetSuggestions(raw: unknown) {
  const { query } = getSuggestionsInputParser.parse(raw);
  const suggestions = await getLiveSuggestions(query, 8);

  return {
    content: [
      {
        type: "text" as const,
        text: `${suggestions.length} sugestão(ões) para "${query}": ${suggestions.map((s) => s.term).join(", ")}.`,
      },
    ],
    structuredContent: {
      view: "suggestions",
      suggestions,
      query,
    },
  };
}
