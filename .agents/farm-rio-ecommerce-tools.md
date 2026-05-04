# Farm Rio Ecommerce — MCP Server Tools Reference

> Server package: `farm-rio-ecommerce-mcp`\
> Start: `pnpm --filter farm-rio-ecommerce-mcp start`\
> Endpoints: SSE `http://localhost:8000/mcp` · POST
> `http://localhost:8000/mcp/messages`\
> Widget URI: `ui://widget/ecommerce-shop.html`

---

## Tool Overview

All 17 tools share:

- `_meta["openai/outputTemplate"]` = `"ui://widget/ecommerce-shop.html"` —
  routes result to widget
- `_meta["openai/toolInvocation/invoking"]` = `"Abrindo a Farm Rio…"` — shown
  while tool runs
- `structuredContent` with a `view` field — tells the widget which panel to
  render

---

## Discovery Tools (read-only)

### `search_products`

Full-text + intent search.\
Input: `query` (string), `category?`, `minPrice?`, `maxPrice?`\
Returns: `{ view: "product-list", products: Product[], query, totalFound }`\
Schema.org: `SearchAction` → `ItemList` of `Product`

### `get_product`

Fetch single product detail.\
Input: `productId` (string)\
Returns: `{ view: "product-detail", product: Product, outfitPairs: Product[] }`\
Schema.org: `Product`, `Offer`, `isRelatedTo`

### `list_categories`

All product categories with item count.\
Input: none\
Returns:
`{ view: "categories", categories: string[], categoryCounts: Record<string,number> }`\
Schema.org: `BreadcrumbList`, `ItemList`

### `get_suggestions`

Autocomplete suggestions for partial query.\
Input: `query` (string)\
Returns: `{ view: "suggestions", suggestions: string[], query }`\
Schema.org: `SearchAction`, `EntryPoint`

### `get_top_searches`

Trending search terms.\
Input: none\
Returns: `{ view: "top-searches", searches: TopSearch[] }`\
Schema.org: `SearchAction`, `ItemList`

### `recommend_outfit`

Complete look based on anchor product.\
Input: `productId` (string)\
Returns:
`{ view: "outfit", anchor: Product, outfitItems: Product[], totalOutfitPrice: number }`\
Schema.org: `ItemList`, `isRelatedTo`, `Product`

---

## Cart Tools

### `add_to_cart`

Add a product to the cart.\
Input: `sessionId`, `productId`, `size`, `quantity` (int ≥ 1)\
Returns: `{ view: "cart", cart: Cart, totals: CartTotals }`

### `remove_from_cart`

Remove an item entirely.\
Input: `sessionId`, `productId`, `size`\
Returns: `{ view: "cart", cart: Cart, totals: CartTotals }`

### `update_item_quantity`

Change quantity by relative delta.\
Input: `sessionId`, `productId`, `size`, `delta` (int, e.g. +1 or -1)\
⚠️ `delta` is **relative**, not absolute. Items with resulting qty ≤ 0 are
removed.\
Returns: `{ view: "cart", cart: Cart, totals: CartTotals }`\
Schema.org: `QuantitativeValue`

### `view_cart`

View current cart state.\
Input: `sessionId`\
Returns: `{ view: "cart", cart: Cart, totals: CartTotals }`

---

## Promotions & Shipping Tools

### `apply_coupon`

Apply a discount coupon.\
Input: `sessionId`, `couponCode`\
Valid codes: `FARM10` (10%), `FARM20` (20%), `PRIMEIRA` (15%), `BLACKFRIDAY`
(25%)\
Returns: `{ view: "cart", cart: Cart, totals: CartTotals, message }`

### `apply_vendor_code`

Apply vendor / influencer code.\
Input: `sessionId`, `vendorCode`\
Valid codes: `VENDEDOR10` (10%), `EMBAIXADORA15` (15%), `PARCEIRO20` (20%)\
Returns: `{ view: "cart", cart: Cart, totals: CartTotals, message }`

### `check_shipping`

Calculate shipping by Brazilian CEP.\
Input: `sessionId`, `cep` (8-digit string)\
Returns:
`{ view: "cart", cart: Cart, totals: CartTotals, shipping: { cost, estimate } }`\
Schema.org: `ParcelDelivery`, `DeliveryChargeSpecification`,
`estimatedDeliveryTime`

---

## Wishlist Tools

### `add_to_wishlist`

Add product to session wishlist.\
Input: `sessionId`, `productId`\
Returns: `{ view: "wishlist", wishlist: Product[], message }`\
Schema.org: `WantAction`

### `view_wishlist`

View session wishlist.\
Input: `sessionId`\
Returns: `{ view: "wishlist", wishlist: Product[] }`\
Schema.org: `ItemList`

### `remove_from_wishlist`

Remove product from wishlist.\
Input: `sessionId`, `productId`\
Returns: `{ view: "wishlist", wishlist: Product[], message }`

---

## Account Tools

### `get_order_history`

Mock past orders for the session.\
Input: `sessionId`\
Returns: `{ view: "orders", orders: Order[] }`\
Schema.org: `Order`, `OrderItem`, `OrderStatus`, `ParcelDelivery`

---

## Data Types

```typescript
interface Product {
    id: string;
    productID: string;
    sku: string;
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
    outfitPairs?: string[]; // product IDs — schema.org/isRelatedTo
}

interface Cart { // schema.org/Order
    items: CartItem[]; // schema.org/orderedItem
    couponCode?: string;
    couponDiscount?: number;
    vendorCode?: string;
    vendorDiscount?: number;
    shippingCep?: string;
    shippingCost?: number; // schema.org/DeliveryChargeSpecification
    shippingEstimate?: string; // schema.org/estimatedDeliveryTime
}

interface CartTotals { // schema.org/PriceSpecification
    subtotal: number;
    couponSavings: number;
    vendorSavings: number;
    shipping: number;
    total: number;
}
```

---

## Widget `view` Values

| `view`             | Panel rendered                        |
| ------------------ | ------------------------------------- |
| `"product-list"`   | `ProductCarousel`                     |
| `"product-detail"` | `ProductDetailPanel` (via modal)      |
| `"outfit"`         | `ProductCarousel` with outfit framing |
| `"cart"`           | `CartPanel`                           |
| `"wishlist"`       | `WishlistPanel`                       |
| `"categories"`     | `FullscreenGrid` with category filter |
| `"orders"`         | `OrderHistoryPanel`                   |
| `"suggestions"`    | Inline suggestion chips               |
| `"top-searches"`   | Trending search chips                 |

---

## Session Management

- `sessionId` is a UUIDv4 generated in the widget on first mount via
  `useWidgetState`.
- The server keeps all state in-memory (no DB); state resets on server restart.
- Widget persists `sessionId` in `widgetState` across conversation turns.
