# OpenAI ChatGPT App — UX/UI Guidelines

> Source: https://developers.openai.com/apps-sdk/concepts/ux-principles\
> Source: https://developers.openai.com/apps-sdk/concepts/ui-guidelines\
> Source: https://developers.openai.com/blog/what-makes-a-great-chatgpt-app

---

## Core UX Principles

### 1. Enhance the conversation — don't interrupt it

- Widgets enrich existing turns; they never replace the conversation thread.
- Never use the widget as a loading spinner or skeleton screen — it should
  render complete, meaningful content on first mount.
- The model decides when to invoke a tool; the widget reacts to the tool result.

### 2. Inline vs. Fullscreen vs. Modal

| Display mode         | When to use                                 | Max items |
| -------------------- | ------------------------------------------- | --------- |
| **Inline** (default) | Quick answers, discovery, product carousels | 3–8 items |
| **Fullscreen**       | Deep browsing, catalogs, order history      | Unlimited |
| **Modal**            | Detail views, cart, checkout — needs focus  | 1 subject |

- Call `requestDisplayMode("fullscreen")` when the user asks to "see all" or
  browse a category.
- Call `requestModal({ view: "..." })` for product detail and cart — avoids
  nested scroll in inline.
- **Never** put a fullscreen grid inside an inline slot.

### 3. The 3-second rule

Every widget must convey its core value within 3 seconds. No spinners, no
skeletons on initial render. Use the tool result that's already in
`structuredContent`.

### 4. Follow-up messages over UI forms

Prefer `sendFollowUpMessage("...")` to surface the next step rather than
building in-widget forms. Example: instead of an in-widget checkout form, send
"Quero finalizar minha compra" as a follow-up.

### 5. Respect system surfaces

- Widgets render inside an iframe-like sandbox; never assume full-page CSS.
- Use `useMaxHeight()` to constrain height; avoid fixed `vh` units.
- Do not intercept global keyboard shortcuts.

---

## UI Component Rules

### Typography

- **System font stack only** — no custom fonts, even in fullscreen.
- `font-sans` (system-ui) for all text.
- Sizes: title `text-sm font-semibold`, meta `text-xs`, price
  `text-sm font-bold`.

### Colors

- **Text**: `text-black` (primary), `text-black/60` (secondary), `text-black/40`
  (disabled).
- **Dividers / borders**: `border-black/[0.07]`.
- **Backgrounds**: `bg-white`, `bg-black/[0.04]` for chips/cards.
- **Brand accent** (`#B84F3B` / `text-[#B84F3B]`): Only on the single primary
  CTA per surface.
- **Never** use arbitrary brand colors for text or backgrounds other than the
  primary CTA.
- Support dark mode with `dark:` variants.

### Buttons (`@openai/apps-sdk-ui/components/Button`)

```tsx
<Button variant="solid" color="primary" size="sm">Adicionar</Button>;
```

- `variant`: `"solid"` | `"soft"` | `"outline"` | `"ghost"`
- `color`: `"primary"` | `"secondary"`
- `size`: `"xs"` | `"sm"` | `"md"`
- **≤ 2 CTAs per inline card surface** — one primary, one ghost/secondary.
- Use `block` for full-width CTA in modal/detail views.

### Images (`@openai/apps-sdk-ui/components/Image`)

- Always use the SDK `Image` component — it handles sandboxed src resolution.
- Provide meaningful `alt` text on every image.
- Aspect ratio: `aspect-[3/4]` for product cards, `aspect-square` for
  thumbnails.

### Cards (inline carousel)

- Max width: `w-36` (144 px) in inline slot.
- Contents per card: image + title + ≤ 2 meta lines + 1 CTA.
- No text truncation at > 2 lines — use `line-clamp-2`.

### Carousel

- Use `embla-carousel-react` (not CSS scroll-snap) for smooth
  hardware-accelerated scroll.
- Show prev/next chevron buttons only when overflow exists.
- 3–8 items; for > 8, add a "Ver todos →" button that calls
  `requestDisplayMode("fullscreen")`.

### Chips / Filter buttons

- `rounded-full`, `bg-black/[0.04]`, `text-xs`, `px-3 py-1`.
- Active chip: `bg-black text-white` (or brand accent on selected state).

### Accessibility

- `aria-label` on all icon-only buttons (heart, minus, plus, cart).
- `aria-pressed` on wishlist toggle buttons.
- `role="list"` / `role="listitem"` on carousels and grids.
- Keyboard navigation: carousel arrow buttons must be focusable.

---

## Animations (framer-motion)

- Use `AnimatePresence` + `motion.div` for view transitions.
- Recommended transition: `initial={{ opacity: 0, y: 8 }}` →
  `animate={{ opacity: 1, y: 0 }}` → `exit={{ opacity: 0, y: -8 }}`,
  `duration: 0.18`.
- No bouncy or spring animations in production widget — keep `ease: "easeOut"`.

---

## Tool result → Widget routing pattern

```tsx
// In the root App component:
const isModalView = displayMode?.mode === "modal";
const view = toolOutput?.view;

if (isModalView) {
    // modal can carry "product-detail" or "cart"
    return view === "cart" ? <CartPanel /> : <ProductDetailPanel />;
}
if (isFullscreen) {
    return <FullscreenGrid />;
}
// inline routing
switch (view) {
    case "product-list":
        return <ProductCarousel />;
    case "product-detail":
        return <ProductCarousel outfitOnly />;
    case "cart":
        return <CartPanel compact />;
    case "outfit":
        return <ProductCarousel />;
    default:
        return <EmptyState />;
}
```

---

## What makes a great ChatGPT App (summary)

1. **Purposeful** — solves one clear problem, not a generic dashboard.
2. **Contextual** — widget content matches the conversation turn, not a static
   catalog.
3. **Fast** — renders in < 3 s, no loading states on tool result display.
4. **Minimal** — < 3 CTAs per surface, clear hierarchy.
5. **Consistent** — uses system colors, system fonts, SDK components.
6. **Accessible** — WCAG AA contrast, full keyboard navigation, screen-reader
   labels.
