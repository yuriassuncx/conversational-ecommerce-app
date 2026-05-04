import assert from "node:assert/strict";
import fs from "node:fs";

import { ANALYTICS_LOG_PATH } from "./lib/analytics.js";
import {
  SESSION_STORE_PATH,
  resetSessionStoreForTests,
} from "./lib/sessionStore.js";
import { executeToolCall } from "./server.js";

type JsonLine = Record<string, unknown>;

function getStructuredContent<T extends Record<string, unknown>>(result: unknown): T {
  const structuredContent = (result as { structuredContent?: T }).structuredContent;
  assert.ok(structuredContent, "Tool result must include structuredContent");
  return structuredContent;
}

function readJsonLines(filePath: string): JsonLine[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    return [];
  }

  return content.split(/\r?\n/u).map((line) => JSON.parse(line) as JsonLine);
}

function cleanupRuntimeArtifacts() {
  resetSessionStoreForTests();
  if (fs.existsSync(ANALYTICS_LOG_PATH)) {
    fs.unlinkSync(ANALYTICS_LOG_PATH);
  }
}

async function main() {
  cleanupRuntimeArtifacts();

  const sessionId = "smoke-session";
  const searchResult = await executeToolCall("search_products", { query: "vestido floral" });
  const searchContent = getStructuredContent<{
    view: string;
    products: Array<{ id: string; sizes: string[] }>;
    totalFound: number;
  }>(searchResult);

  assert.equal(searchContent.view, "product-list");
  assert.ok(searchContent.products.length > 0, "Search should return at least one product");

  const product = searchContent.products[0];
  const size = product.sizes[0] ?? "U";

  const detailResult = await executeToolCall("get_product", { productId: product.id });
  const detailContent = getStructuredContent<{
    view: string;
    product: { id: string };
  }>(detailResult);

  assert.equal(detailContent.view, "product-detail");
  assert.equal(detailContent.product.id, product.id);

  const addToCartResult = await executeToolCall("add_to_cart", {
    sessionId,
    productId: product.id,
    size,
    quantity: 1,
  });
  const addToCartContent = getStructuredContent<{
    view: string;
    cart: { items: Array<{ product: { id: string }; quantity: number }> };
    totals: { total: number };
  }>(addToCartResult);

  assert.equal(addToCartContent.view, "cart");
  assert.equal(addToCartContent.cart.items.length, 1);
  assert.equal(addToCartContent.cart.items[0]?.product.id, product.id);

  const quantityResult = await executeToolCall("update_item_quantity", {
    sessionId,
    productId: product.id,
    size,
    delta: 1,
  });
  const quantityContent = getStructuredContent<{
    view: string;
    cart: { items: Array<{ quantity: number }> };
    totals: { total: number };
  }>(quantityResult);

  assert.equal(quantityContent.view, "cart");
  assert.equal(quantityContent.cart.items[0]?.quantity, 2);

  const removeResult = await executeToolCall("remove_from_cart", {
    sessionId,
    productId: product.id,
    size,
  });
  const removeContent = getStructuredContent<{
    view: string;
    cart: { items: Array<{ quantity: number }> };
    totals: { total: number };
    message?: string;
  }>(removeResult);

  assert.equal(removeContent.view, "cart");
  assert.equal(removeContent.cart.items.length, 0);
  assert.equal(removeContent.totals.total, 0);

  const reAddResult = await executeToolCall("add_to_cart", {
    sessionId,
    productId: product.id,
    size,
    quantity: 1,
  });
  const reAddContent = getStructuredContent<{
    view: string;
    cart: { items: Array<{ product: { id: string }; quantity: number }> };
    totals: { total: number };
  }>(reAddResult);

  assert.equal(reAddContent.view, "cart");
  assert.equal(reAddContent.cart.items.length, 1);
  assert.equal(reAddContent.cart.items[0]?.quantity, 1);

  const couponResult = await executeToolCall("apply_coupon", {
    sessionId,
    couponCode: "INVALID-COPILOT-CODE",
  });
  const couponContent = getStructuredContent<{
    view: string;
    cart: { couponCode?: string };
    totals: { total: number };
    couponError?: string;
  }>(couponResult);

  assert.equal(couponContent.view, "cart");
  assert.ok(
    couponContent.couponError || couponContent.cart.couponCode,
    "Real coupon application should either attach a live coupon or return a live VTEX error"
  );

  const shippingResult = await executeToolCall("check_shipping", {
    sessionId,
    cep: "22250040",
  });
  const shippingContent = getStructuredContent<{
    view: string;
    cart: { shippingEstimate?: string };
    totals: { shipping: number };
    shippingInfo?: { cep: string; cost: number; estimate: string };
  }>(shippingResult);

  assert.equal(shippingContent.view, "cart");
  assert.ok(
    typeof shippingContent.totals.shipping === "number",
    "Shipping calculation should return a real VTEX shipping total"
  );

  const wishlistAddResult = await executeToolCall("add_to_wishlist", {
    sessionId,
    productId: product.id,
  });
  const wishlistAddContent = getStructuredContent<{
    view: string;
    wishlist: Array<{ id: string }>;
  }>(wishlistAddResult);

  assert.equal(wishlistAddContent.view, "wishlist");
  assert.equal(wishlistAddContent.wishlist[0]?.id, product.id);

  const wishlistViewResult = await executeToolCall("view_wishlist", { sessionId });
  const wishlistViewContent = getStructuredContent<{
    view: string;
    wishlist: Array<{ id: string }>;
  }>(wishlistViewResult);

  assert.equal(wishlistViewContent.view, "wishlist");
  assert.equal(wishlistViewContent.wishlist.length, 1);

  const wishlistRemoveResult = await executeToolCall("remove_from_wishlist", {
    sessionId,
    productId: product.id,
  });
  const wishlistRemoveContent = getStructuredContent<{
    view: string;
    wishlist: Array<{ id: string }>;
  }>(wishlistRemoveResult);

  assert.equal(wishlistRemoveContent.view, "wishlist");
  assert.equal(wishlistRemoveContent.wishlist.length, 0);

  const outfitResult = await executeToolCall("recommend_outfit", { productId: product.id });
  const outfitContent = getStructuredContent<{
    view: string;
    anchor: { id: string };
    outfitItems: Array<{ id: string }>;
  }>(outfitResult);

  assert.equal(outfitContent.view, "outfit");
  assert.equal(outfitContent.anchor.id, product.id);
  assert.ok(Array.isArray(outfitContent.outfitItems), "Outfit recommendations should be present");

  const persistedSessions = JSON.parse(
    fs.readFileSync(SESSION_STORE_PATH, "utf8")
  ) as Record<
    string,
    {
      cart: { orderFormId?: string; items?: Array<{ productId: string; size: string; quantity: number }> };
      wishlistProductIds: string[];
    }
  >;

  assert.ok(persistedSessions[sessionId], "Session must be persisted to disk");
  assert.ok(
    (persistedSessions[sessionId].cart.items?.length ?? 0) > 0,
    "Session must persist local cart items"
  );
  assert.equal(persistedSessions[sessionId].wishlistProductIds.length, 0);

  const analyticsEntries = readJsonLines(ANALYTICS_LOG_PATH);
  assert.ok(
    analyticsEntries.some(
      (entry) => entry.type === "tool_invocation" && entry.toolName === "add_to_cart"
    ),
    "Analytics log should include tool invocations"
  );
  assert.ok(
    analyticsEntries.some((entry) => entry.type === "cart_snapshot"),
    "Analytics log should include cart snapshots"
  );
  assert.ok(
    analyticsEntries.some((entry) => entry.type === "wishlist_snapshot"),
    "Analytics log should include wishlist snapshots"
  );

  console.log("Smoke test passed: search, PDP, cart, coupon, wishlist, outfit, persistence, analytics.");
}

main().catch((error) => {
  console.error("Smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});