import { cloneProductForSize, getProductsByIds } from "./farmRioLive.js";
import { getSessionSnapshot, updateSession } from "./sessionStore.js";
import type { Product } from "../data/products.js";

const FARM_RIO_BASE_URL =
  process.env.FARM_RIO_VTEX_BASE_URL?.trim() || "https://www.farmrio.com.br";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RealCartItem {
  product: Product;
  size: string;
  quantity: number;
}

export interface RealCart {
  items: RealCartItem[];
  orderFormId?: string;
  couponCode?: string;
  couponDiscount?: number;
  vendorCode?: string;
  vendorDiscount?: number;
  shippingCost?: number;
  shippingEstimate?: string;
  /** Direct VTEX checkout URL the user can open in their browser to purchase. */
  checkoutUrl?: string;
}

export interface RealCartTotals {
  subtotal: number;
  couponSavings: number;
  vendorSavings: number;
  shipping: number;
  total: number;
}

export interface RealCartState {
  cart: RealCart;
  totals: RealCartTotals;
  orderFormId: string;
  messages: string[];
}

// ─── Checkout URL builder ─────────────────────────────────────────────────
//
// Cloudflare blocks server-side requests to farmrio.com.br from datacenter
// IPs regardless of headers. Instead of calling the VTEX orderForm API we
// manage the cart locally and give users a direct VTEX checkout URL they can
// open in their own browser where Cloudflare does not interfere.

function buildCheckoutUrl(
  items: Array<{ sku: string; quantity: number }>,
  coupon?: string
): string {
  const url = new URL("/checkout/cart/add", FARM_RIO_BASE_URL);
  for (const item of items) {
    url.searchParams.append("sku", item.sku);
    url.searchParams.append("qty", String(item.quantity));
    url.searchParams.append("seller", "1");
  }
  if (coupon) {
    url.searchParams.set("coupon", coupon);
  }
  return url.toString();
}

// ─── Local cart → RealCartState ───────────────────────────────────────────

async function localCartToCartState(sessionId: string): Promise<RealCartState> {
  const session = getSessionSnapshot(sessionId);
  const localItems = session.cart.items ?? [];

  const productIds = [...new Set(localItems.map((i) => i.productId))];
  const products = await getProductsByIds(productIds);
  const productsById = new Map(products.map((p) => [p.id, p]));

  const items: RealCartItem[] = localItems
    .map((stored) => {
      const base = productsById.get(stored.productId);
      if (!base) return null;
      const product = cloneProductForSize(base, stored.size);
      return { product, size: stored.size, quantity: stored.quantity };
    })
    .filter((item): item is RealCartItem => item !== null);

  const couponCode = session.cart.couponCode;
  const vendorCode = session.cart.vendorCode;
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const total = subtotal; // coupons require VTEX; reflected in checkout URL

  const skuItems = localItems
    .map((stored) => {
      const base = productsById.get(stored.productId);
      const sku = base?.sizeSkuMap?.[stored.size] ?? base?.sku ?? stored.productId;
      return { sku, quantity: stored.quantity };
    })
    .filter((i) => Boolean(i.sku));

  const checkoutUrl =
    skuItems.length > 0 ? buildCheckoutUrl(skuItems, couponCode) : undefined;

  const cart: RealCart = {
    items,
    couponCode,
    vendorCode,
    checkoutUrl,
  };

  return {
    cart,
    totals: { subtotal, couponSavings: 0, vendorSavings: 0, shipping: 0, total },
    orderFormId: sessionId,
    messages: [],
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function viewRealCart(sessionId: string): Promise<RealCartState> {
  return localCartToCartState(sessionId);
}

export async function addRealCartItem(
  sessionId: string,
  product: Product,
  size: string,
  quantity: number
): Promise<RealCartState> {
  updateSession(sessionId, (session) => {
    const items = session.cart.items ?? [];
    const existing = items.find(
      (i) => i.productId === product.id && i.size === size
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ productId: product.id, size, quantity });
    }
    session.cart.items = items;
  });

  return localCartToCartState(sessionId);
}

export async function updateRealCartItemQuantity(
  sessionId: string,
  itemId: string,
  nextQuantity: number
): Promise<RealCartState> {
  updateSession(sessionId, (session) => {
    const items = session.cart.items ?? [];
    if (nextQuantity <= 0) {
      session.cart.items = items.filter((i) => i.productId !== itemId);
    } else {
      const item = items.find((i) => i.productId === itemId);
      if (item) item.quantity = nextQuantity;
    }
  });

  return localCartToCartState(sessionId);
}

export async function removeRealCartItem(
  sessionId: string,
  itemId: string
): Promise<RealCartState> {
  return updateRealCartItemQuantity(sessionId, itemId, 0);
}

export async function applyRealCouponCode(
  sessionId: string,
  code: string
): Promise<RealCartState> {
  updateSession(sessionId, (session) => {
    session.cart.couponCode = code.trim() || undefined;
  });
  return localCartToCartState(sessionId);
}

export async function applyRealVendorCode(
  sessionId: string,
  code: string
): Promise<RealCartState> {
  updateSession(sessionId, (session) => {
    session.cart.vendorCode = code.trim() || undefined;
  });
  return localCartToCartState(sessionId);
}

export async function applyRealShippingPostalCode(
  sessionId: string,
  _cep: string
): Promise<RealCartState> {
  // Shipping calculation requires a VTEX browser session which is not
  // available server-side. Return the current cart unchanged; the checkout
  // URL will handle shipping in the user's browser.
  return localCartToCartState(sessionId);
}
