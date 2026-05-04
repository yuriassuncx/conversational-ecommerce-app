export type Product = {
  id: string;
  productID: string;
  sku: string;
  sizeSkuMap?: Record<string, string>;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  gallery?: string[];
  category: string;
  tags: string[];
  sizes: string[];
  color: string;
  installments?: { count: number; value: number };
  inStock: boolean;
  brand: string;
  url?: string;
};

export type CartItem = {
  product: Product;
  size: string;
  quantity: number;
};

export type Cart = {
  items: CartItem[];
  orderFormId?: string;
  couponCode?: string;
  couponDiscount?: number;
  vendorCode?: string;
  vendorDiscount?: number;
  shippingCost?: number;
  shippingEstimate?: string;
};

export type CartTotals = {
  subtotal: number;
  couponSavings: number;
  vendorSavings: number;
  shipping: number;
  total: number;
};

export type CategoryInfo = {
  name: string;
  count?: number;
  emoji: string;
};

export type Suggestion = {
  term: string;
  type: "product" | "category" | "tag";
};

export type TopSearch = {
  term: string;
  trend: "up" | "stable" | "down";
  count: number;
};

export type OrderItem = {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  price: number;
  image: string;
};

export type Order = {
  id: string;
  date: string;
  status: "entregue" | "em_transito" | "processando" | "cancelado";
  statusLabel: string;
  statusColor: "green" | "blue" | "yellow" | "red";
  items: OrderItem[];
  total: number;
  trackingCode?: string;
};

export type CartFeedback = {
  productId: string;
  productName: string;
  size: string;
  addedAt: number;
};

export type SavedLook = {
  id: string;
  title: string;
  note: string;
  anchor: Product;
  supporting: Product[];
  createdAt: number;
};

export type StyleMemory = {
  refinements: string[];
  lastIntent?: string;
  lastPrompt?: string;
  updatedAt?: number;
};

export type ModalSurface = "product-detail" | "product-list" | "outfit" | "cart" | "wishlist";

export type ToolOutput = {
  view?: string;
  products?: Product[];
  product?: Product;
  outfitPairs?: Product[];
  anchor?: Product;
  outfitItems?: Product[];
  totalOutfitPrice?: number;
  cart?: Cart;
  totals?: CartTotals;
  wishlist?: Product[];
  categories?: CategoryInfo[];
  suggestions?: Suggestion[];
  topSearches?: TopSearch[];
  orders?: Order[];
  query?: string;
  error?: string;
  message?: string;
  couponApplied?: { code: string; discount: number; description: string };
  vendorApplied?: { code: string; name: string; discount: number; description: string };
  shippingInfo?: { cep: string; cost: number; estimate: string };
  couponError?: string;
  vendorError?: string;
  totalFound?: number;
} | null;

export type EcommerceState = {
  sessionId: string;
  wishlistIds: string[];
  activeModalView?: ModalSurface | null;
  activeProduct?: Product | null;
  activeOutfitPairs?: Product[] | null;
  cartCount?: number;
  cartTotal?: number;
  cartFeedback?: CartFeedback | null;
  styleMemory?: StyleMemory;
  savedLooks?: SavedLook[];
};