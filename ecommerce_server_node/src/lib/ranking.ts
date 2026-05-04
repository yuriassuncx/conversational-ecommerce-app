import type { Product } from "../data/products.js";

/**
 * Natural-language intent → tag mapping.
 * Allows conversational queries like "para uma festa" to match tagged products.
 */
const INTENT_MAP: Record<string, string[]> = {
  // Season / occasion
  verão: ["verão", "praia", "tropical", "colorido"],
  inverno: ["linho", "elegante", "trabalho"],
  festa: ["festa", "elegante", "noite", "especial"],
  balada: ["festa", "noite", "elegante"],
  casamento: ["elegante", "longo", "bordado", "especial"],
  formatura: ["longo", "festa", "elegante"],
  jantar: ["elegante", "noite", "festa"],
  trabalho: ["trabalho", "elegante", "neutro"],
  escritório: ["trabalho", "elegante", "neutro"],
  praia: ["praia", "verão", "casual", "artesanal"],
  resort: ["praia", "resort", "verão", "longo"],
  viagem: ["casual", "verão", "conforto"],
  // Style
  casual: ["casual", "dia a dia", "conforto"],
  elegante: ["elegante", "festa", "noite"],
  colorido: ["colorido", "estampado", "floral", "tropical"],
  estampado: ["estampado", "floral", "colorido"],
  floral: ["floral", "estampado", "colorido"],
  tropical: ["tropical", "floral", "colorido"],
  // Type
  longo: ["longo"],
  curto: ["curto"],
  midi: ["midi"],
  // Misc
  sustentável: ["sustentável", "natural", "artesanal"],
  artesanal: ["artesanal", "natural"],
  conforto: ["conforto", "casual"],
};

export function expandQuery(query: string): string[] {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/);
  const expandedTags = new Set<string>(words);

  for (const word of words) {
    const mapped = INTENT_MAP[word];
    if (mapped) {
      for (const t of mapped) expandedTags.add(t);
    }
  }

  return Array.from(expandedTags);
}

/**
 * Score a product against a set of query tokens.
 * Higher = more relevant.
 */
export function scoreProduct(product: Product, tokens: string[]): number {
  let score = 0;
  const nameLower = product.name.toLowerCase();
  const descLower = product.description.toLowerCase();
  const tagsLower = product.tags.map((t) => t.toLowerCase());
  const catLower = product.category.toLowerCase();

  for (const token of tokens) {
    // Exact name match — highest weight
    if (nameLower.includes(token)) score += 10;
    // Category match
    if (catLower.includes(token)) score += 8;
    // Tag match — high weight
    if (tagsLower.some((t) => t.includes(token) || token.includes(t))) score += 6;
    // Description match — lower weight
    if (descLower.includes(token)) score += 2;
  }

  // Boost products with a sale price slightly
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    score += 1;
  }

  return score;
}
