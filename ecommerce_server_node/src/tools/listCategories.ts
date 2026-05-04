/**
 * listCategories — enumerate all available product categories.
 *
 * Schema.org vocabulary:
 *   @see https://schema.org/BreadcrumbList — category list as a navigation breadcrumb
 *   @see https://schema.org/ItemList       — structured list of category items
 */
import { getLiveCategories } from "../lib/farmRioLive.js";

interface CategoryInfo {
  name: string;
  count?: number;
  emoji: string;
}

export const listCategoriesInputSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

export async function handleListCategories(_raw?: unknown) {
  const categories = (await getLiveCategories()) as CategoryInfo[];

  return {
    content: [
      {
        type: "text" as const,
        text:
          categories.length > 0
            ? `Categorias reais disponíveis na Farm Rio: ${categories.map((category) => category.name).join(", ")}.`
            : "Nenhuma categoria disponível no momento pela VTEX da Farm Rio.",
      },
    ],
    structuredContent: {
      view: "categories",
      categories,
    },
  };
}
