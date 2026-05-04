# Build & Dev Workflow

> Root workspace: `openai-apps-sdk-examples/`\
> Package manager: `pnpm` (workspaces)\
> Widget builder: `build-all.mts` (tsx script)\
> Server: `ecommerce_server_node/` (tsx, MCP SDK 0.5)

---

## Quick Start

```powershell
# 1. Install dependencies
pnpm install

# 2. Build the ecommerce widget
pnpm run build -- --target ecommerce-shop

# 3. Start the MCP server (port 8000)
pnpm --filter farm-rio-ecommerce-mcp start

# 4. (Optional) Serve static assets (port 4444)
pnpm run serve
```

---

## Build System

### Correct build command

```powershell
pnpm run build -- --target ecommerce-shop
```

This runs `tsx ./build-all.mts --target ecommerce-shop` which:

1. Vite-builds `src/ecommerce-shop/index.tsx` → `assets/ecommerce-shop.js` +
   `.css`
2. Renames to `assets/ecommerce-shop-{hash}.js` + `.css` (hash from
   `pkg.version`)
3. Generates **two** HTML files:
   - `assets/ecommerce-shop.html` (direct, always exists)
   - `assets/ecommerce-shop-{hash}.html` (versioned)

### ⚠️ Do NOT use

```powershell
pnpm vite build   # Only generates JS, no HTML — server will crash
```

### Current hash: `2d2b`

Asset filenames: `ecommerce-shop-2d2b.js`, `ecommerce-shop-2d2b.css`

### HTML format generated

```html
<!doctype html><html><head>
  <script>window.__APP_URL_CONFIG__ = {"apiBaseUrl":"http://localhost:8000","assetsBaseUrl":"http://localhost:4444"};</script>
  <script type="module" src="http://localhost:4444/ecommerce-shop-2d2b.js"></script>
  <link rel="stylesheet" href="http://localhost:4444/ecommerce-shop-2d2b.css">
</head><body><div id="ecommerce-shop-root"></div></body></html>
```

---

## Widget Entry Point

`src/ecommerce-shop/index.tsx` must export both:

```typescript
export { App }; // named — required by build-all virtual-entry wrapper
export default App; // default — required by Rollup, suppresses warning
```

The mount code at the bottom is only for dev/local preview:

```typescript
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
```

---

## Server HTML Lookup (`server.ts`)

```typescript
function readWidgetHtml(): string {
    // 1. Try assets/ecommerce-shop.html (direct)
    const directPath = path.join(ASSETS_DIR, `${WIDGET_NAME}.html`);
    if (fs.existsSync(directPath)) return fs.readFileSync(directPath, "utf8");

    // 2. Fallback: assets/ecommerce-shop-*.html (latest hash)
    const candidates = fs.readdirSync(ASSETS_DIR)
        .filter((f) => f.startsWith(`${WIDGET_NAME}-`) && f.endsWith(".html"))
        .sort();
    // ...
}
```

The server reads the HTML **once at startup** and holds it in memory.

---

## TypeScript Checks

```powershell
# Widget (Vite / React)
cd <workspace-root>
npx tsc --noEmit -p tsconfig.app.json

# Server
cd ecommerce_server_node
npx tsc --noEmit
```

---

## Key Files

| File                                                 | Purpose                               |
| ---------------------------------------------------- | ------------------------------------- |
| `src/ecommerce-shop/index.tsx`                       | React widget (~800 lines)             |
| `ecommerce_server_node/src/server.ts`                | MCP server, 17 tools registered       |
| `ecommerce_server_node/src/data/products.ts`         | 30 real Farm Rio products             |
| `ecommerce_server_node/src/tools/addToCart.ts`       | Cart CRUD (delta-based qty)           |
| `ecommerce_server_node/src/tools/wishlist.ts`        | Wishlist CRUD                         |
| `ecommerce_server_node/src/tools/applyCoupon.ts`     | Coupons, vendor codes, shipping       |
| `ecommerce_server_node/src/tools/recommendOutfit.ts` | Outfit recommendations                |
| `ecommerce_server_node/src/tools/getOrderHistory.ts` | Mock order history                    |
| `assets/ecommerce-shop.html`                         | Built widget HTML (served to ChatGPT) |
| `build-all.mts`                                      | Multi-widget build script             |
| `tailwind.config.ts`                                 | `darkMode: "class"`                   |

---

## Environment Variables (`.env.local`)

| Variable               | Default                 | Description             |
| ---------------------- | ----------------------- | ----------------------- |
| `VITE_API_BASE_URL`    | `http://localhost:8000` | MCP server base URL     |
| `VITE_ASSETS_BASE_URL` | `http://localhost:4444` | Static asset server URL |

---

## Known Warnings (non-blocking)

```
[plugin @tailwindcss/vite:generate:build] Sourcemap is likely to be incorrect
```

This is a Tailwind v4 + Vite 7 known issue. Does not affect runtime. Build
exits 0.

---

## Dependencies

```json
"@openai/apps-sdk-ui": "^0.x",
"embla-carousel-react": "^8.0.0",
"framer-motion": "^11.x",
"lucide-react": "^0.x",
"clsx": "^2.x",
"@modelcontextprotocol/sdk": "^0.5.0",
"zod": "^3.x"
```
