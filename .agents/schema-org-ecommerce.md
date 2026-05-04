# Schema.org Vocabulary — Farm Rio Ecommerce

Mappings between our data model and [Schema.org](https://schema.org) types.\
Apply these annotations in JSDoc (`@see`) and `structuredContent` field naming.

---

## Core Types

| Our type / concept       | Schema.org type                                                                  | Notes                    |
| ------------------------ | -------------------------------------------------------------------------------- | ------------------------ |
| `Product`                | [`schema.org/Product`](https://schema.org/Product)                               | Top-level product entity |
| `Product.price`          | [`schema.org/Offer`](https://schema.org/Offer) > `price`                         | Offer wraps pricing      |
| `Product.compareAtPrice` | [`schema.org/Offer`](https://schema.org/Offer) > `priceValidUntil`               | Strike-through price     |
| `Product.brand`          | [`schema.org/Brand`](https://schema.org/Brand)                                   | "Farm Rio"               |
| `Product.inStock`        | [`schema.org/ItemAvailability`](https://schema.org/ItemAvailability)             | `InStock` / `OutOfStock` |
| `Product.outfitPairs`    | [`schema.org/isRelatedTo`](https://schema.org/isRelatedTo)                       | Related product IDs      |
| `Product.installments`   | [`schema.org/UnitPriceSpecification`](https://schema.org/UnitPriceSpecification) | Installment plan         |

---

## Cart Types

| Our type / field             | Schema.org type                                                          | Notes               |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------- |
| `Cart`                       | [`schema.org/Order`](https://schema.org/Order)                           | Pre-purchase order  |
| `Cart.items`                 | [`schema.org/orderedItem`](https://schema.org/orderedItem)               | Array of OrderItems |
| `CartItem`                   | [`schema.org/OrderItem`](https://schema.org/OrderItem)                   | Line item in cart   |
| `CartItem.quantity`          | [`schema.org/orderQuantity`](https://schema.org/orderQuantity)           |                     |
| `CartItem.size`              | [`schema.org/name`](https://schema.org/name) (variant)                   | Size variant label  |
| `CartTotals`                 | [`schema.org/PriceSpecification`](https://schema.org/PriceSpecification) | Price breakdown     |
| `update_item_quantity.delta` | [`schema.org/QuantitativeValue`](https://schema.org/QuantitativeValue)   | Relative change ±N  |

---

## Shipping Types

| Our type / field   | Schema.org type                                                                            | Notes                 |
| ------------------ | ------------------------------------------------------------------------------------------ | --------------------- |
| Shipping result    | [`schema.org/ParcelDelivery`](https://schema.org/ParcelDelivery)                           |                       |
| `shippingCost`     | [`schema.org/DeliveryChargeSpecification`](https://schema.org/DeliveryChargeSpecification) |                       |
| `shippingEstimate` | [`schema.org/estimatedDeliveryTime`](https://schema.org/estimatedDeliveryTime)             | Human-readable string |
| CEP input          | [`schema.org/PostalAddress`](https://schema.org/PostalAddress) > `postalCode`              |                       |

---

## Action Types

| Operation          | Schema.org action                                                                                                       | Notes              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `search_products`  | [`schema.org/SearchAction`](https://schema.org/SearchAction)                                                            | User search intent |
| `get_suggestions`  | [`schema.org/SearchAction`](https://schema.org/SearchAction) + [`schema.org/EntryPoint`](https://schema.org/EntryPoint) | Autocomplete       |
| `get_top_searches` | [`schema.org/SearchAction`](https://schema.org/SearchAction) (trending)                                                 |                    |
| `add_to_wishlist`  | [`schema.org/WantAction`](https://schema.org/WantAction)                                                                | Desire / save      |
| `recommend_outfit` | [`schema.org/ItemList`](https://schema.org/ItemList) + `isRelatedTo`                                                    | Curated outfit     |

---

## List Types

| Our concept            | Schema.org type                                                  |
| ---------------------- | ---------------------------------------------------------------- |
| Product search results | [`schema.org/ItemList`](https://schema.org/ItemList)             |
| Category list          | [`schema.org/BreadcrumbList`](https://schema.org/BreadcrumbList) |
| Wishlist               | [`schema.org/ItemList`](https://schema.org/ItemList)             |
| Outfit items           | [`schema.org/ItemList`](https://schema.org/ItemList)             |

---

## Order History Types

| Our field            | Schema.org type                                                       |
| -------------------- | --------------------------------------------------------------------- |
| `Order`              | [`schema.org/Order`](https://schema.org/Order)                        |
| `Order.id`           | [`schema.org/orderNumber`](https://schema.org/orderNumber)            |
| `Order.date`         | [`schema.org/orderDate`](https://schema.org/orderDate) (ISO 8601)     |
| `Order.status`       | [`schema.org/OrderStatus`](https://schema.org/OrderStatus)            |
| `Order.items`        | [`schema.org/orderedItem`](https://schema.org/orderedItem)            |
| `Order.trackingCode` | [`schema.org/trackingUrl`](https://schema.org/trackingUrl) (CORREIOS) |
| `OrderItem.quantity` | [`schema.org/orderQuantity`](https://schema.org/orderQuantity)        |
| `OrderItem.price`    | [`schema.org/price`](https://schema.org/price)                        |

---

## Coding Convention

Add `@see` JSDoc to every interface and handler that maps to Schema.org:

```typescript
/** @see https://schema.org/OrderItem */
export interface CartItem {
    /** @see https://schema.org/orderedItem */
    product: Product;
    /** @see https://schema.org/orderQuantity */
    quantity: number;
}
```

Add inline comments to `structuredContent` returns:

```typescript
return {
    /**
     * @see https://schema.org/ItemList (products)
     * @see https://schema.org/Product  (each item)
     */
    structuredContent: { view: "product-list", products, totalFound },
};
```
