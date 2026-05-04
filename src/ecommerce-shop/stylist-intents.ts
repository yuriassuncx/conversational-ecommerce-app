import type { Product } from "./types";

export type StylistIntent =
  | "discover"
  | "refine-results"
  | "refine-product"
  | "style-product"
  | "continue-look"
  | "adjust-cart"
  | "saved-look";

function compact(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildStylistPrompt({
  intent,
  request,
  product,
  query,
  category,
  refinements = [],
  savedLookTitle,
}: {
  intent: StylistIntent;
  request: string;
  product?: Product;
  query?: string;
  category?: string;
  refinements?: string[];
  savedLookTitle?: string;
}): string {
  const normalizedRequest = compact(request) ?? request;
  const normalizedSavedLookTitle = compact(savedLookTitle);

  const lines = [
    "[FARM_RIO_STYLIST_INTENT]",
    `intent=${intent}`,
    compact(query) ? `query=${compact(query)}` : undefined,
    compact(category) ? `category=${compact(category)}` : undefined,
    product ? `product=${product.name}` : undefined,
    product ? `product_id=${product.id}` : undefined,
    normalizedSavedLookTitle ? `saved_look=${normalizedSavedLookTitle}` : undefined,
    refinements.length ? `style_signals=${refinements.join(" | ")}` : undefined,
    `customer_request=${normalizedRequest}`,
  ].filter(Boolean);

  return lines.join("\n");
}