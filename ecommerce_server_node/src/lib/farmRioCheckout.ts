import { cloneProductForSize, getProductById, getProductsByIds } from "./farmRioLive.js";
import { getSessionSnapshot, updateSession } from "./sessionStore.js";
import type { Product } from "../data/products.js";

const FARM_RIO_BASE_URL =
  process.env.FARM_RIO_VTEX_BASE_URL?.trim() || "https://www.farmrio.com.br";
const CHECKOUT_BASE_URL = new URL("/api/checkout/pub/orderForm/", FARM_RIO_BASE_URL);
const REQUEST_TIMEOUT_MS = 8_000;

export interface VtexOrderFormMessage {
  text?: string;
}

export interface VtexOrderFormItem {
  id?: string | number;
  productId?: string | number;
  name?: string;
  skuName?: string;
  quantity?: number;
  sellingPrice?: number;
  price?: number;
  listPrice?: number;
  imageUrl?: string;
  detailUrl?: string;
  seller?: string;
}

export interface VtexOrderFormTotalizer {
  id?: string;
  value?: number;
}

export interface VtexOrderFormSla {
  id?: string;
  price?: number;
  shippingEstimate?: string;
}

export interface VtexOrderFormLogisticsInfo {
  selectedSla?: string;
  slas?: VtexOrderFormSla[];
}

export interface VtexOrderFormShippingData {
  logisticsInfo?: VtexOrderFormLogisticsInfo[];
}

export interface VtexOrderFormMarketingData {
  coupon?: string | null;
}

export interface VtexOrderForm {
  orderFormId: string;
  items?: VtexOrderFormItem[];
  totalizers?: VtexOrderFormTotalizer[];
  value?: number;
  shippingData?: VtexOrderFormShippingData | null;
  marketingData?: VtexOrderFormMarketingData | null;
  messages?: VtexOrderFormMessage[];
}

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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toStringId(value: string | number | undefined): string {
  return normalizeWhitespace(String(value ?? ""));
}

function centsToBrl(value?: number): number {
  return (value ?? 0) / 100;
}

function totalizerValue(orderForm: VtexOrderForm, id: string): number {
  return orderForm.totalizers?.find((entry) => entry.id === id)?.value ?? 0;
}

function formatShippingEstimate(estimate?: string): string | undefined {
  if (!estimate) {
    return undefined;
  }

  const businessDays = estimate.match(/^(\d+)bd$/iu);
  if (businessDays) {
    const days = Number(businessDays[1]);
    return `${days} dia${days === 1 ? " útil" : "s úteis"}`;
  }

  return estimate;
}

function absoluteUrl(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }

  try {
    return new URL(path, FARM_RIO_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function messageTexts(orderForm: VtexOrderForm): string[] {
  return (orderForm.messages ?? [])
    .map((message) => normalizeWhitespace(message.text ?? ""))
    .filter(Boolean);
}

function selectedShipping(orderForm: VtexOrderForm): VtexOrderFormSla | null {
  const logistics = orderForm.shippingData?.logisticsInfo ?? [];
  for (const entry of logistics) {
    const selected = entry.slas?.find((sla) => sla.id === entry.selectedSla);
    if (selected) {
      return selected;
    }

    if (entry.slas?.[0]) {
      return entry.slas[0];
    }
  }

  return null;
}

async function invokeCheckout<T>(
  path: string,
  init: Omit<RequestInit, "signal"> & { body?: string }
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(new URL(path, CHECKOUT_BASE_URL), {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Farm Rio checkout ${path} failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function createOrderForm(): Promise<VtexOrderForm> {
  return invokeCheckout<VtexOrderForm>("", {
    method: "POST",
    body: "{}",
  });
}

async function getOrderForm(orderFormId: string): Promise<VtexOrderForm> {
  return invokeCheckout<VtexOrderForm>(`${orderFormId}`, {
    method: "GET",
  });
}

function persistOrderFormId(sessionId: string, orderFormId: string) {
  updateSession(sessionId, (session) => {
    session.cart.orderFormId = orderFormId;
  });
}

async function ensureOrderForm(sessionId: string): Promise<VtexOrderForm> {
  const currentOrderFormId = getSessionSnapshot(sessionId).cart.orderFormId;

  if (currentOrderFormId) {
    try {
      return await getOrderForm(currentOrderFormId);
    } catch (error) {
      console.warn("existing orderForm lookup failed; creating a fresh VTEX orderForm", error);
    }
  }

  const orderForm = await createOrderForm();
  persistOrderFormId(sessionId, orderForm.orderFormId);
  return orderForm;
}

function deriveSize(product: Product | undefined, item: VtexOrderFormItem): string {
  const skuId = toStringId(item.id);
  if (product?.sizeSkuMap) {
    const matchedSize = Object.entries(product.sizeSkuMap).find(([, mappedSku]) => mappedSku === skuId)?.[0];
    if (matchedSize) {
      return matchedSize;
    }
  }

  const skuName = normalizeWhitespace(item.skuName ?? "");
  const suffix = skuName.split(" - ").at(-1);
  if (suffix && product?.sizes.includes(suffix)) {
    return suffix;
  }

  if (product?.sizes.length === 1) {
    return product.sizes[0] ?? "U";
  }

  return "U";
}

function buildOrderFormProduct(item: VtexOrderFormItem, size: string): Product {
  const skuId = toStringId(item.id);
  const image = normalizeWhitespace(item.imageUrl ?? "");
  const price = centsToBrl(item.sellingPrice ?? item.price);

  return {
    id: skuId,
    productID: skuId,
    sku: skuId,
    gtin: "",
    name: normalizeWhitespace(item.name ?? skuId),
    description: normalizeWhitespace(item.name ?? skuId),
    shortDescription: normalizeWhitespace(item.name ?? skuId),
    price,
    compareAtPrice: undefined,
    image,
    gallery: image ? [image] : undefined,
    category: "outro",
    tags: [],
    sizes: size ? [size] : [],
    color: "",
    installments: undefined,
    inStock: true,
    brand: "Farm Rio",
    url: absoluteUrl(item.detailUrl),
    sizeSkuMap: size ? { [size]: skuId } : undefined,
  };
}

async function orderFormToCartState(orderForm: VtexOrderForm): Promise<RealCartState> {
  const orderItems = orderForm.items ?? [];
  const products = await getProductsByIds(orderItems.map((item) => toStringId(item.id)).filter(Boolean));
  const productsById = new Map(products.map((product) => [product.id, product]));

  const items: RealCartItem[] = orderItems.map((item) => {
    const itemId = toStringId(item.id);
    const knownProduct = productsById.get(itemId);
    const size = deriveSize(knownProduct, item);
    const baseProduct = knownProduct ? cloneProductForSize(knownProduct, size) : buildOrderFormProduct(item, size);
    const sellingPrice = centsToBrl(item.sellingPrice ?? item.price);
    const compareAtPrice = centsToBrl(item.listPrice);

    return {
      product: {
        ...baseProduct,
        price: sellingPrice,
        compareAtPrice: compareAtPrice > sellingPrice ? compareAtPrice : baseProduct.compareAtPrice,
        image: normalizeWhitespace(item.imageUrl ?? baseProduct.image),
        url: absoluteUrl(item.detailUrl) ?? baseProduct.url,
      },
      size,
      quantity: item.quantity ?? 0,
    };
  });

  const subtotal = centsToBrl(totalizerValue(orderForm, "Items"));
  const couponSavings = Math.abs(centsToBrl(totalizerValue(orderForm, "Discounts")));
  const shipping = centsToBrl(totalizerValue(orderForm, "Shipping"));
  const shippingChoice = selectedShipping(orderForm);

  const cart: RealCart = {
    items,
    orderFormId: orderForm.orderFormId,
    couponCode: normalizeWhitespace(orderForm.marketingData?.coupon ?? "") || undefined,
    shippingCost: shipping > 0 ? shipping : undefined,
    shippingEstimate: formatShippingEstimate(shippingChoice?.shippingEstimate),
  };

  return {
    cart,
    totals: {
      subtotal,
      couponSavings,
      vendorSavings: 0,
      shipping,
      total: centsToBrl(orderForm.value),
    },
    orderFormId: orderForm.orderFormId,
    messages: messageTexts(orderForm),
  };
}

function addItemsBody(product: Product, size: string, quantity: number): string {
  const sku = product.sizeSkuMap?.[size] ?? product.sku;
  return JSON.stringify({
    orderItems: [
      {
        id: sku,
        quantity,
        seller: "1",
      },
    ],
  });
}

export async function viewRealCart(sessionId: string): Promise<RealCartState> {
  const orderForm = await ensureOrderForm(sessionId);
  return orderFormToCartState(orderForm);
}

export async function addRealCartItem(
  sessionId: string,
  product: Product,
  size: string,
  quantity: number
): Promise<RealCartState> {
  const orderForm = await ensureOrderForm(sessionId);
  const updatedOrderForm = await invokeCheckout<VtexOrderForm>(`${orderForm.orderFormId}/items`, {
    method: "POST",
    body: addItemsBody(product, size, quantity),
  });

  persistOrderFormId(sessionId, updatedOrderForm.orderFormId);
  return orderFormToCartState(updatedOrderForm);
}

export async function updateRealCartItemQuantity(
  sessionId: string,
  itemId: string,
  nextQuantity: number
): Promise<RealCartState> {
  const orderForm = await ensureOrderForm(sessionId);
  const normalizedItemId = normalizeWhitespace(itemId);
  const itemIndex = (orderForm.items ?? []).findIndex(
    (item) =>
      toStringId(item.id) === normalizedItemId ||
      toStringId(item.productId) === normalizedItemId
  );

  if (itemIndex < 0) {
    return orderFormToCartState(orderForm);
  }

  const updatedOrderForm = await invokeCheckout<VtexOrderForm>(`${orderForm.orderFormId}/items`, {
    method: "PATCH",
    body: JSON.stringify({
      orderItems: [
        {
          index: itemIndex,
          quantity: nextQuantity,
        },
      ],
    }),
  });

  persistOrderFormId(sessionId, updatedOrderForm.orderFormId);
  return orderFormToCartState(updatedOrderForm);
}

export async function removeRealCartItem(
  sessionId: string,
  itemId: string
): Promise<RealCartState> {
  return updateRealCartItemQuantity(sessionId, itemId, 0);
}

async function applyCodeToOrderForm(sessionId: string, code: string): Promise<RealCartState> {
  const orderForm = await ensureOrderForm(sessionId);
  const updatedOrderForm = await invokeCheckout<VtexOrderForm>(`${orderForm.orderFormId}/coupons`, {
    method: "POST",
    body: JSON.stringify({ text: code }),
  });

  persistOrderFormId(sessionId, updatedOrderForm.orderFormId);
  return orderFormToCartState(updatedOrderForm);
}

export async function applyRealCouponCode(sessionId: string, code: string): Promise<RealCartState> {
  return applyCodeToOrderForm(sessionId, code);
}

export async function applyRealVendorCode(sessionId: string, code: string): Promise<RealCartState> {
  return applyCodeToOrderForm(sessionId, code);
}

export async function applyRealShippingPostalCode(sessionId: string, cep: string): Promise<RealCartState> {
  const orderForm = await ensureOrderForm(sessionId);

  if ((orderForm.items ?? []).length === 0) {
    return orderFormToCartState(orderForm);
  }

  const normalizedCep = normalizeWhitespace(cep).replace(/\D/g, "");
  const updatedOrderForm = await invokeCheckout<VtexOrderForm>(`${orderForm.orderFormId}/attachments/shippingData`, {
    method: "POST",
    body: JSON.stringify({
      selectedAddresses: [
        {
          postalCode: normalizedCep,
          country: "BRA",
        },
      ],
    }),
  });

  persistOrderFormId(sessionId, updatedOrderForm.orderFormId);
  return orderFormToCartState(updatedOrderForm);
}