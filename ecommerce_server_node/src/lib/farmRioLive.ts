import type { Product, ProductCategory } from "../data/products.js";
import { expandQuery, scoreProduct } from "./ranking.js";

const FARM_RIO_BASE_URL =
  process.env.FARM_RIO_VTEX_BASE_URL?.trim() || "https://www.farmrio.com.br";
const LIVE_INVOKE_BASE_URL = new URL("/live/invoke/", FARM_RIO_BASE_URL);
const REQUEST_TIMEOUT_MS = 8_000;

const PRODUCT_LIST_LOADER = "vtex/loaders/intelligentSearch/productList.ts";
const SUGGESTIONS_LOADER = "vtex/loaders/intelligentSearch/suggestions.ts";
const TOP_SEARCHES_LOADER = "vtex/loaders/intelligentSearch/topsearches.ts";
const CATEGORY_TREE_LOADER = "vtex/loaders/categories/tree.ts";

const PLACEHOLDER_VALUES = new Set(["", ".", "-", "tipo de cor"]);
const DESCRIPTION_SUFFIX_PATTERNS = [
  /\s*FARM Rio, coleção As Cariocas - alto inverno 26\.?$/iu,
  /\s*o que não se veste, se vive\. chegou FARM Etc, a marca de lifestyle da FARM Rio\.?$/iu,
];
const TAG_STOPWORDS = new Set([
  "a",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "farm",
  "para",
  "rio",
  "uma",
  "um",
]);

const productCache = new Map<string, Product>();
const DISPLAY_CATEGORY_ORDER: ProductCategory[] = [
  "vestido",
  "blusa",
  "saia",
  "calça",
  "macacão",
  "conjunto",
  "acessório",
  "outro",
];

interface SearchOptions {
  query: string;
  category?: string;
  maxPrice?: number;
  minPrice?: number;
  limit?: number;
}

interface SuggestionEntry {
  term: string;
  type: "product" | "category" | "tag";
}

interface TopSearchEntry {
  term: string;
  trend: "up" | "stable" | "down";
  count: number;
}

interface LiveAdditionalProperty {
  name?: string;
  value?: string;
  propertyID?: string;
  valueReference?: string;
}

interface LiveImageObject {
  url?: string;
}

interface LiveInventoryLevel {
  value?: number;
}

interface LiveUnitPriceSpecification {
  priceType?: string;
  priceComponentType?: string;
  billingDuration?: number;
  billingIncrement?: number;
  price?: number;
}

interface LiveOffer {
  price?: number;
  availability?: string;
  inventoryLevel?: LiveInventoryLevel;
  sellerName?: string;
  priceSpecification?: LiveUnitPriceSpecification[];
}

interface LiveAggregateOffer {
  lowPrice?: number;
  highPrice?: number;
  offers?: LiveOffer[];
}

interface LiveVariantProduct {
  productID?: string | null;
  sku?: string | null;
  name?: string;
  additionalProperty?: LiveAdditionalProperty[];
}

interface LiveParentProduct {
  name?: string;
  model?: string;
  additionalProperty?: LiveAdditionalProperty[];
  hasVariant?: LiveVariantProduct[];
}

interface LiveBrand {
  name?: string;
}

interface LiveProduct {
  productID?: string | null;
  sku?: string | null;
  gtin?: string | null;
  name?: string;
  description?: string | null;
  category?: string;
  image?: LiveImageObject[];
  offers?: LiveAggregateOffer;
  brand?: LiveBrand | string;
  additionalProperty?: LiveAdditionalProperty[];
  isVariantOf?: LiveParentProduct;
  url?: string;
}

interface LiveSuggestionsResponse {
  searches?: Array<{ term?: string }>;
  products?: LiveProduct[];
}

interface LiveTopSearchesResponse {
  searches?: Array<{ term?: string; count?: number }>;
}

interface LiveCategoryNode {
  name?: string;
  children?: LiveCategoryNode[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSentenceSpacing(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\s*([,.;!?])/g, "$1")
    .replace(/([.!?])(?=[^\s])/g, "$1 ");
}

function sentenceCase(value: string): string {
  const normalized = normalizeSentenceSpacing(value);
  if (!normalized) {
    return normalized;
  }

  return normalized.charAt(0).toLocaleUpperCase("pt-BR") + normalized.slice(1);
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&");
}

function isPlaceholder(value?: string): boolean {
  const normalized = normalizeWhitespace(value ?? "").toLocaleLowerCase("pt-BR");
  return PLACEHOLDER_VALUES.has(normalized);
}

function stripCatalogBoilerplate(value: string): string {
  let normalized = normalizeSentenceSpacing(stripHtml(value));

  for (const pattern of DESCRIPTION_SUFFIX_PATTERNS) {
    normalized = normalized.replace(pattern, "");
  }

  return sentenceCase(normalized);
}

function firstSentence(value: string): string {
  const match = value.match(/^(.+?[.!?])(\s|$)/u);
  return match ? match[1].trim() : value;
}

function clampCopy(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength - 1);
  const boundary = truncated.lastIndexOf(" ");
  const safeValue = boundary >= Math.floor(maxLength * 0.6) ? truncated.slice(0, boundary) : truncated;
  return `${safeValue.trimEnd()}…`;
}

function normalizeTextToken(value: string): string {
  return normalizeWhitespace(value).toLocaleLowerCase("pt-BR");
}

function extractKeywords(value: string): string[] {
  return normalizeSentenceSpacing(value)
    .toLocaleLowerCase("pt-BR")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4 && !TAG_STOPWORDS.has(token));
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => normalizeWhitespace(value ?? "")).filter(Boolean)));
}

function slugFromUrl(url?: string): string {
  if (!url) {
    return "";
  }

  try {
    const pathname = new URL(url).pathname;
    const [slug] = pathname.split("/p");
    return normalizeWhitespace(slug.replace(/^\//u, ""));
  } catch {
    return normalizeWhitespace(url);
  }
}

function propertyValues(properties: LiveAdditionalProperty[] | undefined, names: string[]): string[] {
  const normalizedNames = names.map((name) => normalizeTextToken(name));

  return uniqueStrings(
    (properties ?? [])
      .filter((property) => normalizedNames.includes(normalizeTextToken(property.name ?? "")))
      .map((property) => property.value ?? "")
  );
}

function allProperties(product: LiveProduct): LiveAdditionalProperty[] {
  return [
    ...(product.additionalProperty ?? []),
    ...(product.isVariantOf?.additionalProperty ?? []),
  ];
}

function normalizeCategory(value: string): ProductCategory {
  const normalized = normalizeTextToken(value);

  if (/(vestido|dress)/u.test(normalized)) return "vestido";
  if (/(blusa|camisa|shirt|t-shirt|top|cropped)/u.test(normalized)) return "blusa";
  if (/saia/u.test(normalized)) return "saia";
  if (/(calça|calca|short|bermuda|jeans)/u.test(normalized)) return "calça";
  if (/(macacão|macacao|macaquinho|jardineira)/u.test(normalized)) return "macacão";
  if (/(bolsa|acess|colar|brinco|pulseira|cinto|lenço|lenco|garrafa|mochila|sandália|sandalia|chinelo)/u.test(normalized)) return "acessório";
  if (/conjunto/u.test(normalized)) return "conjunto";
  return "outro";
}

function resolveCategory(product: LiveProduct): ProductCategory {
  const categoryValues = propertyValues(allProperties(product), ["category"]);
  const leafCategory = categoryValues.at(-1) || product.category || slugFromUrl(product.url);
  return normalizeCategory(leafCategory);
}

function resolveBrand(product: LiveProduct): string {
  const propertyBrand = propertyValues(allProperties(product), ["Marca"]).at(0);
  if (propertyBrand) {
    return sentenceCase(propertyBrand);
  }

  if (typeof product.brand === "string") {
    return sentenceCase(product.brand);
  }

  if (product.brand?.name) {
    return sentenceCase(product.brand.name);
  }

  return "Farm Rio";
}

function resolveColor(product: LiveProduct, category: ProductCategory): string {
  const properties = allProperties(product);
  const color = propertyValues(properties, ["Cores Filtráveis", "ColorFamily", "Cor"]).at(0);
  if (color && !isPlaceholder(color) && normalizeTextToken(color) !== "liso") {
    return sentenceCase(color);
  }

  const typeColor = propertyValues(properties, ["Tipo de Cor"]).at(0);
  if (typeColor && !isPlaceholder(typeColor) && normalizeTextToken(typeColor) !== "liso") {
    return sentenceCase(typeColor);
  }

  return category === "acessório" ? "Mix de cores" : "Estampa exclusiva";
}

function resolveDescription(product: LiveProduct): string {
  const description = product.description;
  if (description && !isPlaceholder(description)) {
    return stripCatalogBoilerplate(description);
  }

  return sentenceCase(product.isVariantOf?.name ?? product.name ?? "Produto Farm Rio");
}

function resolveShortDescription(product: LiveProduct, description: string): string {
  const summary = firstSentence(description);
  if (summary) {
    return clampCopy(summary, 120);
  }

  return clampCopy(sentenceCase(product.isVariantOf?.name ?? product.name ?? ""), 120);
}

function resolveGallery(product: LiveProduct): string[] | undefined {
  const gallery = uniqueStrings((product.image ?? []).map((image) => image.url ?? ""));
  return gallery.length > 0 ? gallery : undefined;
}

function resolvePrice(product: LiveProduct): number {
  return product.offers?.lowPrice ?? product.offers?.offers?.[0]?.price ?? 0;
}

function resolveCompareAtPrice(product: LiveProduct, price: number): number | undefined {
  const specifications = product.offers?.offers?.flatMap((offer) => offer.priceSpecification ?? []) ?? [];
  const listPrice = specifications.find((specification) => specification.priceType?.endsWith("ListPrice"))?.price;
  if (typeof listPrice === "number" && listPrice > price) {
    return listPrice;
  }

  const highPrice = product.offers?.highPrice;
  return typeof highPrice === "number" && highPrice > price ? highPrice : undefined;
}

function resolveInstallments(product: LiveProduct): Product["installments"] {
  const specifications = product.offers?.offers?.flatMap((offer) => offer.priceSpecification ?? []) ?? [];
  const installments = specifications
    .filter(
      (specification) =>
        specification.priceComponentType?.endsWith("Installment") &&
        typeof specification.billingDuration === "number" &&
        specification.billingDuration > 1
    )
    .sort((left, right) => (right.billingDuration ?? 0) - (left.billingDuration ?? 0));

  const best = installments[0];
  if (!best?.billingDuration) {
    return undefined;
  }

  return {
    count: best.billingDuration,
    value: best.billingIncrement ?? best.price ?? 0,
  };
}

function resolveVariantEntries(product: LiveProduct): Array<{ size: string; sku: string }> {
  return (product.isVariantOf?.hasVariant ?? [])
    .map((variant) => {
      const size = propertyValues(variant.additionalProperty, ["Tamanho"]).at(0);
      const sku = normalizeWhitespace(variant.productID ?? variant.sku ?? "");

      if (!size || !sku) {
        return null;
      }

      return { size: normalizeWhitespace(size), sku };
    })
    .filter((entry): entry is { size: string; sku: string } => entry != null);
}

function resolveSizeSkuMap(product: LiveProduct): Record<string, string> | undefined {
  const variantEntries = resolveVariantEntries(product);
  if (variantEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(variantEntries.map((entry) => [entry.size, entry.sku]));
}

function resolveSizes(
  product: LiveProduct,
  sizeSkuMap: Record<string, string> | undefined,
  category: ProductCategory
): string[] {
  const variantSizes = sizeSkuMap ? Object.keys(sizeSkuMap) : [];
  if (variantSizes.length > 0) {
    return variantSizes;
  }

  const sizes = propertyValues(allProperties(product), ["Tamanho"]);
  if (sizes.length > 0) {
    return sizes;
  }

  return category === "acessório" ? ["U"] : [];
}

function resolveProductId(product: LiveProduct): string {
  return normalizeWhitespace(
    product.productID ?? product.sku ?? product.isVariantOf?.model ?? slugFromUrl(product.url)
  );
}

function resolveName(product: LiveProduct): string {
  const rawName = product.isVariantOf?.name ?? product.name ?? "Produto Farm Rio";
  return sentenceCase(rawName.replace(/\s+-\s+[A-Z0-9-]+$/u, ""));
}

function resolveTags(
  product: LiveProduct,
  category: ProductCategory,
  color: string,
  description: string
): string[] {
  const properties = allProperties(product);
  const categories = propertyValues(properties, ["category"]);
  const clusters = propertyValues(properties, ["cluster", "Coleção", "Coleção Atual"]);

  return uniqueStrings([
    ...categories,
    ...clusters,
    category,
    color,
    ...extractKeywords(resolveName(product)),
    ...extractKeywords(description),
  ]).map((tag) => tag.toLocaleLowerCase("pt-BR"));
}

function resolveOutfitPairs(product: LiveProduct): string[] | undefined {
  const rawPairs = propertyValues(allProperties(product), ["otherLookProducts"])
    .flatMap((value) => value.split(/[;,|]/u))
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);

  return rawPairs.length > 0 ? Array.from(new Set(rawPairs)) : undefined;
}

function mapLiveProduct(product: LiveProduct): Product {
  const id = resolveProductId(product);
  const category = resolveCategory(product);
  const description = resolveDescription(product);
  const sizeSkuMap = resolveSizeSkuMap(product);
  const sizes = resolveSizes(product, sizeSkuMap, category);
  const price = resolvePrice(product);
  const compareAtPrice = resolveCompareAtPrice(product, price);
  const gallery = resolveGallery(product);
  const color = resolveColor(product, category);
  const tags = resolveTags(product, category, color, description);
  const brand = resolveBrand(product);
  const firstImage = gallery?.[0] ?? "";

  return {
    id,
    productID: normalizeWhitespace(product.productID ?? id),
    sku: normalizeWhitespace(product.sku ?? product.productID ?? id),
    gtin: normalizeWhitespace(product.gtin ?? ""),
    name: resolveName(product),
    description,
    shortDescription: resolveShortDescription(product, description),
    price,
    compareAtPrice,
    image: firstImage,
    gallery,
    category,
    tags,
    sizes,
    color,
    installments: resolveInstallments(product),
    inStock: (product.offers?.offers ?? []).some(
      (offer) => (offer.inventoryLevel?.value ?? 0) > 0 || offer.availability?.endsWith("InStock")
    ),
    brand,
    url: normalizeWhitespace(product.url ?? ""),
    outfitPairs: resolveOutfitPairs(product),
    sizeSkuMap,
  };
}

function dedupeProducts(products: Product[]): Product[] {
  return Array.from(new Map(products.map((product) => [product.id, product])).values());
}

function cacheProducts(products: Product[]) {
  for (const product of products) {
    productCache.set(product.id, product);
  }
}

function searchCachedProducts(opts: SearchOptions): Product[] {
  const cachedProducts = Array.from(productCache.values());
  if (cachedProducts.length === 0) {
    return [];
  }

  const { query, category, maxPrice, minPrice, limit = 12 } = opts;
  const tokens = expandQuery(query);

  let results = cachedProducts.map((product) => ({
    product,
    score: scoreProduct(product, tokens),
  }));

  const hasTokens = tokens.some((token) => token.length > 2);
  if (hasTokens) {
    results = results.filter((result) => result.score > 0);
  }

  if (category) {
    results = results.filter((result) => result.product.category === category);
  }

  if (maxPrice !== undefined) {
    results = results.filter((result) => result.product.price <= maxPrice);
  }

  if (minPrice !== undefined) {
    results = results.filter((result) => result.product.price >= minPrice);
  }

  results.sort((left, right) => right.score - left.score);
  if (results.length === 0) {
    return [];
  }

  return results.slice(0, limit).map((result) => result.product);
}

function filterProducts(products: Product[], opts: SearchOptions): Product[] {
  return products.filter((product) => {
    if (opts.category && product.category !== opts.category) {
      return false;
    }
    if (opts.maxPrice !== undefined && product.price > opts.maxPrice) {
      return false;
    }
    if (opts.minPrice !== undefined && product.price < opts.minPrice) {
      return false;
    }
    return true;
  });
}

async function invokeLoader<T>(loaderPath: string, props: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(new URL(loaderPath, LIVE_INVOKE_BASE_URL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ props }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Farm Rio loader ${loaderPath} failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchLiveProductList(props: Record<string, unknown>): Promise<Product[]> {
  const result = await invokeLoader<Array<LiveProduct | null>>(PRODUCT_LIST_LOADER, props);
  const mapped = dedupeProducts(
    result
      .filter((product): product is LiveProduct => product != null && typeof product === "object")
      .map(mapLiveProduct)
      .filter((product) => Boolean(product.id))
  );
  cacheProducts(mapped);
  return mapped;
}

export async function searchLiveProducts(opts: SearchOptions): Promise<Product[]> {
  const limit = opts.limit ?? 12;
  const count = Math.min(Math.max(limit * 3, limit), 24);

  try {
    const primaryResults = filterProducts(
      await fetchLiveProductList({
        query: opts.query,
        count,
        hideUnavailableItems: true,
      }),
      opts
    );

    if (primaryResults.length > 0 || !opts.category) {
      return primaryResults.slice(0, limit);
    }

    const secondaryResults = filterProducts(
      await fetchLiveProductList({
        query: `${opts.query} ${opts.category}`.trim(),
        count,
        hideUnavailableItems: true,
      }),
      opts
    );

    if (secondaryResults.length > 0) {
      return secondaryResults.slice(0, limit);
    }
  } catch (error) {
    console.warn("live product search failed; using cached live products only", error);
  }

  return searchCachedProducts(opts);
}

function chunk<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const requestedIds = ids.map((id) => normalizeWhitespace(id)).filter(Boolean);
  const missingIds = Array.from(new Set(requestedIds)).filter((id) => !productCache.has(id));

  try {
    for (const batch of chunk(missingIds, 10)) {
      if (batch.length === 0) {
        continue;
      }

      await fetchLiveProductList({ ids: batch, count: batch.length, hideUnavailableItems: false });
    }
  } catch (error) {
    console.warn("live product lookup by id failed; using cache where available", error);
  }

  return requestedIds
    .map((id) => productCache.get(id))
    .filter((product): product is Product => product != null);
}

export async function getProductById(id: string): Promise<Product | null> {
  const normalizedId = normalizeWhitespace(id);

  if (productCache.has(normalizedId)) {
    return productCache.get(normalizedId) ?? null;
  }

  const [product] = await getProductsByIds([normalizedId]);
  if (product) {
    return product;
  }

  return null;
}

export function resolveSkuForSize(product: Product, size: string): string {
  return product.sizeSkuMap?.[size] ?? product.sku ?? product.productID;
}

export function cloneProductForSize(product: Product, size: string): Product {
  const sku = resolveSkuForSize(product, size);
  if (sku === product.sku) {
    return product;
  }

  return {
    ...product,
    sku,
  };
}

export async function recommendProductsForAnchor(anchor: Product, limit = 3): Promise<Product[]> {
  const explicitPairs = (await getProductsByIds(anchor.outfitPairs ?? [])).filter(
    (product) => product.id !== anchor.id
  );

  const seen = new Set([anchor.id, ...explicitPairs.map((product) => product.id)]);
  const results = [...explicitPairs];
  if (results.length >= limit) {
    return results.slice(0, limit);
  }

  const preferredCategory = anchor.category === "acessório" ? "vestido" : "acessório";
  const candidateQueries = [
    [anchor.color, preferredCategory].filter(Boolean).join(" "),
    [...anchor.tags.slice(0, 2), preferredCategory].join(" "),
    [anchor.category, ...anchor.tags.slice(0, 2)].join(" "),
  ].filter(Boolean);

  for (const query of candidateQueries) {
    const candidates = await searchLiveProducts({ query, limit: limit * 3 });
    for (const candidate of candidates) {
      if (seen.has(candidate.id)) {
        continue;
      }

      if (
        preferredCategory === "acessório" &&
        candidate.category !== "acessório" &&
        candidate.category === anchor.category
      ) {
        continue;
      }

      seen.add(candidate.id);
      results.push(candidate);

      if (results.length >= limit) {
        return results.slice(0, limit);
      }
    }
  }

  return results.slice(0, limit);
}

export async function getLiveSuggestions(query: string, limit = 8): Promise<SuggestionEntry[]> {
  try {
    const response = await invokeLoader<LiveSuggestionsResponse>(SUGGESTIONS_LOADER, {
      query,
      count: limit,
    });

    const suggestions = new Map<string, SuggestionEntry["type"]>();
    for (const term of response.searches?.map((entry) => normalizeWhitespace(entry.term ?? "")) ?? []) {
      if (term) {
        suggestions.set(term, "tag");
      }
    }

    for (const liveProduct of response.products ?? []) {
      const product = mapLiveProduct(liveProduct);
      suggestions.set(product.name, "product");
      suggestions.set(product.category, "category");
    }

    if (suggestions.size > 0) {
      return Array.from(suggestions.entries())
        .slice(0, limit)
        .map(([term, type]) => ({ term, type }));
    }
  } catch (error) {
    console.warn("live suggestions failed; using cached live products only", error);
  }

  const cachedProducts = searchCachedProducts({ query, limit: limit * 2 });
  const matches = new Map<string, SuggestionEntry["type"]>();
  for (const product of cachedProducts) {
    if (product.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) {
      matches.set(product.name, "product");
    }
    if (product.category.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) {
      matches.set(product.category, "category");
    }
    for (const tag of product.tags) {
      if (tag.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) {
        matches.set(tag, "tag");
      }
    }
  }

  return Array.from(matches.entries())
    .slice(0, limit)
    .map(([term, type]) => ({ term, type }));
}

export async function getLiveTopSearches(limit = 10): Promise<TopSearchEntry[]> {
  try {
    const response = await invokeLoader<LiveTopSearchesResponse>(TOP_SEARCHES_LOADER, {});
    const searches = (response.searches ?? []).slice(0, limit);

    if (searches.length > 0) {
      return searches.map((entry, index) => ({
        term: normalizeWhitespace(entry.term ?? ""),
        count: entry.count ?? 0,
        trend: index < 4 ? "up" : index < 8 ? "stable" : "down",
      }));
    }
  } catch (error) {
    console.warn("live top searches failed", error);
  }

  return [];
}

function collectCategoryNames(nodes: LiveCategoryNode[]): string[] {
  const collected: string[] = [];

  for (const node of nodes) {
    const name = normalizeWhitespace(node.name ?? "");
    if (name) {
      collected.push(name);
    }

    if (node.children?.length) {
      collected.push(...collectCategoryNames(node.children));
    }
  }

  return collected;
}

const CATEGORY_EMOJIS: Record<ProductCategory, string> = {
  vestido: "👗",
  blusa: "👚",
  saia: "🩱",
  "calça": "👖",
  "macacão": "🧵",
  conjunto: "✨",
  "acessório": "👜",
  outro: "🛍️",
};

export async function getLiveCategories(): Promise<Array<{ name: ProductCategory; emoji: string }>> {
  try {
    const tree = await invokeLoader<LiveCategoryNode[]>(CATEGORY_TREE_LOADER, { level: 2 });
    const available = new Set<ProductCategory>();

    for (const name of collectCategoryNames(tree)) {
      const normalized = normalizeCategory(name);
      if (normalized !== "outro") {
        available.add(normalized);
      }

      if (/farmetc/iu.test(name)) {
        available.add("outro");
      }
    }

    return DISPLAY_CATEGORY_ORDER.filter((category) => available.has(category)).map((category) => ({
      name: category,
      emoji: CATEGORY_EMOJIS[category],
    }));
  } catch (error) {
    console.warn("live categories failed", error);
    return [];
  }
}