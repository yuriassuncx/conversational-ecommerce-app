/**
 * Farm Rio Ecommerce Widget — ChatGPT App
 *
 * Design references:
      void Promise.resolve(window.openai.openExternal({ href })).catch((error: unknown) => {
 *   UI Guidelines  → https://developers.openai.com/apps-sdk/concepts/ui-guidelines
 *   Great apps     → https://developers.openai.com/blog/what-makes-a-great-chatgpt-app
 *
 * Architecture decisions aligned with official guidelines:
 *   • Inline carousel for product discovery (3–8 items, image + title + ≤2 meta + single CTA)
 *   • Fullscreen 3-col grid with category filter chips for deep catalog browsing
 *   • requestModal for product detail and cart — no nested scrolling in inline mode
 *   • requestDisplayMode("fullscreen") behind "Ver todos" action
 *   • System font stack only — no custom fonts even in fullscreen
 *   • System colors for all text/icons/dividers (text-black, text-black/60, border-black/[0.07])
 *   • Brand accent (#B84F3B) exclusively on the primary action button
 *   • ≤2 CTAs per inline card surface
 *   • WCAG AA: alt text on all images, aria-labels on icon buttons, aria-pressed on toggles
 *
 * Schema.org vocabulary used:
 *   @see https://schema.org/Product
 *   @see https://schema.org/Offer
 *   @see https://schema.org/Brand
 *   @see https://schema.org/OrderItem
 *   @see https://schema.org/Order
 */

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import useEmblaCarousel from "embla-carousel-react";

import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Image } from "@openai/apps-sdk-ui/components/Image";
import { CommerceImage } from "./components/commerce/CommerceImage";
import { FollowUpSuggestions } from "./components/conversation/FollowUpSuggestions";
import { RefinementChips } from "./components/conversation/RefinementChips";
import { StyleMemoryPanel } from "./components/conversation/StyleMemoryPanel";
import { HeroLook } from "./components/editorial/HeroLook";
import { MoodboardRail } from "./components/editorial/MoodboardRail";
import { SavedLooksRail } from "./components/editorial/SavedLooksRail";
import { MiniCartBar } from "./components/commerce/MiniCartBar";
import { ProductDetailPanel } from "./components/commerce/ProductDetailPanel";
import { brl, installmentLabel } from "./format";
import { buildStylistPrompt } from "./stylist-intents";
import type {
  Cart,
  CartTotals,
  CategoryInfo,
  EcommerceState,
  ModalSurface,
  Order,
  Product,
  SavedLook,
  Suggestion,
  ToolOutput,
  TopSearch,
} from "./types";
import { useDisplayMode } from "../use-display-mode";
import { useMaxHeight } from "../use-max-height";
import { useOpenAiGlobal } from "../use-openai-global";
import { useWidgetState } from "../use-widget-state";

// ─── Widget persistent state ──────────────────────────────────────────────────

const ECOMMERCE_WIDGET_STATE_STORAGE_KEY = "farm-rio-ecommerce-widget-state-v1";

function readPersistedWidgetState(): EcommerceState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ECOMMERCE_WIDGET_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<EcommerceState>;
    if (!parsed.sessionId || typeof parsed.sessionId !== "string") {
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      wishlistIds: Array.isArray(parsed.wishlistIds) ? parsed.wishlistIds : [],
      activeModalView: parsed.activeModalView ?? null,
      activeProduct: parsed.activeProduct ?? null,
      activeOutfitPairs: parsed.activeOutfitPairs ?? null,
      cartCount: typeof parsed.cartCount === "number" ? parsed.cartCount : 0,
      cartTotal: typeof parsed.cartTotal === "number" ? parsed.cartTotal : 0,
      cartFeedback: parsed.cartFeedback ?? null,
      styleMemory: parsed.styleMemory ?? { refinements: [] },
      savedLooks: Array.isArray(parsed.savedLooks) ? parsed.savedLooks : [],
    };
  } catch (error) {
    console.error("failed to read persisted ecommerce widget state", error);
    return null;
  }
}

function persistWidgetStateLocally(state: EcommerceState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ECOMMERCE_WIDGET_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("failed to persist ecommerce widget state", error);
  }
}

function generateSessionId(): string {
  return `fr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultState(): EcommerceState {
  const persistedState = readPersistedWidgetState();
  if (persistedState) {
    return persistedState;
  }

  return {
    sessionId: generateSessionId(),
    wishlistIds: [],
    activeModalView: null,
    activeProduct: null,
    activeOutfitPairs: null,
    cartCount: 0,
    cartTotal: 0,
    cartFeedback: null,
    styleMemory: { refinements: [] },
    savedLooks: [],
  };
}

// ─── Product Card ─────────────────────────────────────────────────────────────

/**
 * Shared card used by the inline carousel (compact) and the fullscreen grid (grid).
 *
 * UI Guidelines rule: single CTA per carousel item; ≤2 CTAs per inline card.
 */
function ProductCard({
  product,
  variant = "compact",
  isWishlisted,
  onOpenDetail,
  onToggleWishlist,
}: {
  product: Product;
  variant?: "compact" | "grid";
  isWishlisted: boolean;
  onOpenDetail: (product: Product) => void;
  onToggleWishlist: (id: string) => void;
}) {
  const isCompact = variant === "compact";
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(product)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(product);
        }
      }}
      className={clsx(
        "group flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.75rem] border border-black/[0.07] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b84f3b]/35",
        isCompact ? "w-40 shrink-0" : "w-full"
      )}
    >
      {/* Product image — alt text required for WCAG AA */}
      <div className="relative overflow-hidden bg-[#f5ede4]">
        <CommerceImage
          src={product.image}
          alt={`${product.name} — ${product.brand}`}
          className={clsx(
            "w-full",
            "aspect-[3/4]"
          )}
          fallbackLabel={product.category}
        />

        {/* Discount badge — system colors, no custom backgrounds on text */}
        {discount > 0 && (
          <span
            aria-label={`${discount}% de desconto`}
            className="absolute left-2 top-2 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-white"
          >
            -{discount}%
          </span>
        )}

        {/* Wishlist toggle */}
        <button
          type="button"
          aria-label={
            isWishlisted
              ? `Remover ${product.name} dos favoritos`
              : `Salvar ${product.name} nos favoritos`
          }
          aria-pressed={isWishlisted}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm transition-colors hover:bg-white"
          onClick={(event) => {
            event.stopPropagation();
            onToggleWishlist(product.id);
          }}
        >
          <Heart
            aria-hidden="true"
            className={clsx(
              "h-3.5 w-3.5 transition-colors",
              isWishlisted ? "text-black" : "text-black/30"
            )}
            fill={isWishlisted ? "currentColor" : "none"}
          />
        </button>
      </div>

      {/* Card body — title + ≤2 lines metadata (UI Guidelines carousel rule) */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-black/35">
            {product.brand}
          </p>
          <span className="rounded-full bg-[#f5ede4] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/38">
            {product.category}
          </span>
        </div>
        <p
          className={clsx(
            "line-clamp-2 font-medium leading-snug text-black",
            isCompact ? "text-xs" : "text-sm"
          )}
        >
          {product.name}
        </p>
        <div className="mt-auto min-h-[3.5rem] space-y-0.5 pt-1">
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <p className="text-[10px] text-black/30 line-through">
              {brl(product.compareAtPrice)}
            </p>
          )}
          <p
            className={clsx(
              "font-semibold text-black",
              isCompact ? "text-sm" : "text-base"
            )}
          >
            {brl(product.price)}
          </p>
          {product.installments && product.installments.count > 1 && (
            <p className="text-[10px] text-black/45">
              {installmentLabel(product.installments)}
            </p>
          )}
        </div>
      </div>

      {/* Single CTA per carousel item — UI Guidelines */}
      <div className="px-3 pb-3">
        <div className="rounded-full bg-[#f7f1ea] px-3 py-2 text-center text-sm font-semibold text-black transition-colors duration-200 group-hover:bg-[#ebdfd1] group-focus-visible:bg-[#ebdfd1]">
          {isCompact ? "Abrir detalhes" : "Ver detalhes"}
        </div>
      </div>
    </motion.article>
  );
}

// ─── Inline Carousel ──────────────────────────────────────────────────────────

/**
 * Inline carousel for product discovery.
 *
 * UI Guidelines — inline carousel:
 *   • 3–8 items
 *   • Image always present
 *   • Title + max 2 lines metadata
 *   • Single CTA per item
 *   • No nested scrolling
 */
function ProductCarousel({
  products,
  wishlistIds,
  wishlistCount,
  query,
  totalFound,
  styleSignals,
  onRefine,
  onOpenDetail,
  onOpenWishlist,
  onToggleWishlist,
  onSeeAll,
}: {
  products: Product[];
  wishlistIds: string[];
  wishlistCount: number;
  query?: string;
  totalFound?: number;
  styleSignals: string[];
  onRefine: (chip: string, query?: string) => void;
  onOpenDetail: (product: Product) => void;
  onOpenWishlist: () => void;
  onToggleWishlist: (id: string) => void;
  onSeeAll?: () => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const update = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    emblaApi.on("select", update);
    emblaApi.on("reInit", update);
    update();
    return () => {
      emblaApi.off("select", update);
      emblaApi.off("reInit", update);
    };
  }, [emblaApi]);

  // UI Guidelines: inline carousel shows 3–8 items
  const displayed = products.slice(0, 8);
  const quickSignals = useMemo(
    () =>
      Array.from(
        new Set(
          displayed.flatMap((product) => [product.category, ...product.tags.slice(0, 2)])
        )
      ).slice(0, 5),
    [displayed]
  );
  const leadProduct = displayed[0];
  const resultCount = totalFound ?? products.length;

  return (
    <section className="mx-3 my-3 space-y-4 rounded-[2rem] bg-[linear-gradient(180deg,#fffdf9_0%,#f6efe7_100%)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.06] sm:mx-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
              Descoberta assistida
            </p>
            <h2 className="text-lg font-semibold leading-tight text-black">
              {query ? `Seleção inicial para “${query}”` : "Peças para começar a explorar"}
            </h2>
            <p className="max-w-full text-sm leading-6 text-black/60 sm:max-w-[32rem]">
              {leadProduct
                ? `Separei ${resultCount} opção${resultCount === 1 ? "" : "ões"} com leitura forte para começar. Abra uma peça para ver galeria, tamanhos e combinações a partir de ${leadProduct.name}.`
                : "Use esta faixa para começar a conversa por imagem, preço e intenção de uso."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {wishlistCount > 0 ? (
              <button
                type="button"
                onClick={onOpenWishlist}
                className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-black/70 transition-colors hover:border-black/[0.14] hover:bg-[#f8f1e8] hover:text-black"
              >
                Favoritos ({wishlistCount})
              </button>
            ) : null}
            {onSeeAll && products.length > 0 ? (
              <Button type="button" variant="solid" color="primary" size="sm" onClick={onSeeAll}>
                Ver coleção
              </Button>
            ) : null}
          </div>
        </div>

        {quickSignals.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {quickSignals.map((signal) => (
              <button
                key={signal}
                type="button"
                onClick={() => onRefine(signal, query)}
                className="rounded-full bg-white/82 px-3 py-1.5 text-xs font-medium text-black/70 ring-1 ring-black/[0.06] transition-colors hover:bg-white hover:text-black"
              >
                {signal}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Embla scrollable track — horizontal scroll only, no nested vertical scroll */}
      <div
        ref={emblaRef}
        className="overflow-hidden"
        aria-label="Produtos encontrados"
      >
        <div className="flex gap-4 px-1 py-1">
          {displayed.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              variant="compact"
              isWishlisted={wishlistIds.includes(p.id)}
              onOpenDetail={onOpenDetail}
              onToggleWishlist={onToggleWishlist}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-black/50">
          Deslize para comparar e abra a peça que mais se aproxima do mood da conversa.
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Rolar para o início"
            disabled={!canScrollPrev}
            onClick={() => emblaApi?.scrollPrev()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] transition-colors hover:bg-[#f7f1ea] disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Rolar para frente"
            disabled={!canScrollNext}
            onClick={() => emblaApi?.scrollNext()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] transition-colors hover:bg-[#f7f1ea] disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-3 border-t border-black/[0.06] pt-4">
        <StyleMemoryPanel refinements={styleSignals} />
        <RefinementChips onSelect={(chip) => onRefine(chip, query)} />
      </div>
    </section>
  );
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

function CartPanel({
  cart,
  totals,
  message,
  couponError,
  vendorError,
  shippingInfo,
  savedLooks,
  styleSignals,
  onOpenSavedLook,
  onContinueWithStylist,
  onCheckout,
  onUpdateQuantity,
}: {
  cart: Cart;
  totals: CartTotals;
  message?: string;
  couponError?: string;
  vendorError?: string;
  shippingInfo?: { cep: string; cost: number; estimate: string };
  savedLooks: SavedLook[];
  styleSignals: string[];
  onOpenSavedLook: (look: SavedLook) => void;
  onContinueWithStylist: (suggestion: string) => void;
  onCheckout: (cart: Cart) => void;
  onUpdateQuantity: (productId: string, size: string, delta: number) => void;
}) {
  const totalItems = cart.items.reduce((acc, i) => acc + i.quantity, 0);
  const notices = [message, couponError, vendorError].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-4 bg-[linear-gradient(180deg,#faf7f2_0%,#ffffff_22%,#ffffff_100%)] px-4 pb-5 pt-4 sm:px-5">
      <div className="rounded-[1.75rem] bg-white/86 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.05]">
            <ShoppingCart className="h-4 w-4 text-black/55" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
              Seu look ganha forma
            </p>
            <h2 className="text-base font-semibold text-black">
              {totalItems} {totalItems === 1 ? "peça escolhida" : "peças escolhidas"}
            </h2>
            <p className="text-sm leading-6 text-black/58">
              Revise seu mix com calma. Posso ajustar proporção, ocasião, paleta ou incluir uma nova peça sem perder a fluidez do look.
            </p>
          </div>
        </div>
      </div>

      {notices.length > 0 ? (
        <div className="flex flex-col gap-2">
          {notices.map((notice) => (
            <div
              key={notice}
              className="rounded-[1.25rem] bg-[#f7f1ea] px-4 py-3 text-sm leading-6 text-black/72 ring-1 ring-black/[0.06]"
            >
              {notice}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {cart.items.map((item) => (
          <div
            key={`${item.product.id}-${item.size}`}
            className="flex items-center gap-3 rounded-[1.5rem] bg-white p-3 shadow-[0_10px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]"
          >
            <Image
              src={item.product.image}
              alt={item.product.name}
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate text-sm font-medium text-black">
                {item.product.name}
              </p>
              <p className="text-xs text-black/45">
                {item.size !== "U" ? `Tam. ${item.size}` : item.product.color}
              </p>
              <p className="text-sm font-semibold text-black">
                {brl(item.product.price * item.quantity)}
              </p>
            </div>
            <div
              className="flex shrink-0 items-center rounded-full bg-black/[0.04] px-1 py-0.5"
              role="group"
              aria-label={`Quantidade de ${item.product.name}`}
            >
              <button
                type="button"
                aria-label={`Diminuir quantidade de ${item.product.name}`}
                onClick={() =>
                  onUpdateQuantity(item.product.id, item.size, -1)
                }
                className="flex h-8 w-8 items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/[0.06] hover:text-black"
              >
                <Minus
                  className="h-3 w-3"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
              <span
                className="min-w-[1.5rem] text-center text-sm font-medium text-black"
                aria-label={`Quantidade: ${item.quantity}`}
              >
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label={`Aumentar quantidade de ${item.product.name}`}
                onClick={() =>
                  onUpdateQuantity(item.product.id, item.size, 1)
                }
                className="flex h-8 w-8 items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/[0.06] hover:text-black"
              >
                <Plus
                  className="h-3 w-3"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[1.75rem] bg-white p-4 shadow-[0_10px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]">
        <div className="flex flex-wrap gap-2 pb-3">
          {totals.couponSavings > 0 && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              Cupom {cart.couponCode}
            </span>
          )}
          {totals.vendorSavings > 0 && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              Código parceiro
            </span>
          )}
          {totals.shipping === 0 && totalItems > 0 && (
            <span className="rounded-full bg-black/[0.08] px-3 py-1 text-xs font-medium text-black/72">
              Frete grátis
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-black/[0.06] pt-3">
          <div className="flex justify-between text-sm text-black/55">
            <span>Subtotal</span>
            <span>{brl(totals.subtotal)}</span>
          </div>
          {totals.couponSavings > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Cupom {cart.couponCode}</span>
              <span>-{brl(totals.couponSavings)}</span>
            </div>
          )}
          {totals.vendorSavings > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Código parceiro</span>
              <span>-{brl(totals.vendorSavings)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-black/55">
            <span>Frete</span>
            <span>
              {totals.shipping === 0 ? "Grátis" : brl(totals.shipping)}
            </span>
          </div>
          {shippingInfo?.estimate ? (
            <div className="flex justify-between text-sm text-black/55">
              <span>Entrega</span>
              <span>
                {shippingInfo.cep} • {shippingInfo.estimate}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-black/[0.06] pt-1.5 text-base font-semibold text-black">
            <span>Total</span>
            <span>{brl(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="solid"
          color="primary"
          size="md"
          block
          disabled={cart.items.length === 0}
          onClick={() => onCheckout(cart)}
        >
          Finalizar compra
        </Button>
        <Button
          type="button"
          variant="ghost"
          color="secondary"
          size="sm"
          block
          onClick={() => onContinueWithStylist("Me ajude a revisar esse carrinho e montar um look mais coerente")}
        >
          Revisar comigo no chat
        </Button>
        <StyleMemoryPanel refinements={styleSignals} lastIntent="ajustes recentes" />
        <SavedLooksRail looks={savedLooks} onOpenLook={onOpenSavedLook} />
        <FollowUpSuggestions
          title="Próximos passos"
          suggestions={[
            "Quer uma bolsa que combine?",
            "Monte uma versão mais elegante",
            "Deixe esse look mais leve",
          ]}
          onSelect={onContinueWithStylist}
        />
      </div>
    </div>
  );
}

// ─── Wishlist Panel ───────────────────────────────────────────────────────────

function WishlistPanel({
  wishlist,
  wishlistIds,
  onOpenDetail,
  onToggleWishlist,
}: {
  wishlist: Product[];
  wishlistIds: string[];
  onOpenDetail: (product: Product) => void;
  onToggleWishlist: (id: string) => void;
}) {
  if (wishlist.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Heart className="h-8 w-8 text-black/20" aria-hidden="true" />
        <p className="text-sm text-black/50">
          Sua lista de favoritos está vazia. Explore o catálogo e salve seus
          produtos preferidos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-black/[0.06] px-4 py-3">
        <h2 className="text-sm font-semibold text-black">
          Favoritos{" "}
          <span className="font-normal text-black/45">({wishlist.length})</span>
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        {wishlist.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            variant="grid"
            isWishlisted={wishlistIds.includes(p.id)}
            onOpenDetail={onOpenDetail}
            onToggleWishlist={onToggleWishlist}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Fullscreen Product Grid ──────────────────────────────────────────────────

const FILTER_CATEGORIES = [
  { id: "all", label: "Tudo" },
  { id: "vestido", label: "Vestidos" },
  { id: "blusa", label: "Blusas" },
  { id: "saia", label: "Saias" },
  { id: "macacão", label: "Macacões" },
  { id: "calça", label: "Calças" },
  { id: "conjunto", label: "Conjuntos" },
  { id: "outro", label: "Farm Etc" },
] as const;

/**
 * Fullscreen grid — deepens engagement without replicating the native app.
 * ChatGPT composer always overlaid, control returns to conversation naturally.
 *
 * UI Guidelines — fullscreen:
 *   • Works with system composer
 *   • Deepens engagement (not a native app replica)
 */
function FullscreenGrid({
  products,
  wishlistIds,
  onOpenDetail,
  onSearchQuery,
  onToggleWishlist,
}: {
  products: Product[];
  wishlistIds: string[];
  onOpenDetail: (product: Product) => void;
  onSearchQuery: (query: string, category?: string) => void;
  onToggleWishlist: (id: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const maxHeight = useMaxHeight();

  // Only show categories that have matching products
  const availableCategories = useMemo(() => {
    const presentIds = new Set(products.map((p) => p.category));
    return FILTER_CATEGORIES.filter(
      (cat) => cat.id === "all" || presentIds.has(cat.id)
    );
  }, [products]);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  const curatedSections = useMemo(() => {
    if (activeCategory !== "all") {
      return [
        {
          id: activeCategory,
          title: availableCategories.find((cat) => cat.id === activeCategory)?.label ?? "Seleção",
          description: "Uma seleção enxuta para explorar com calma.",
          products: filtered,
        },
      ];
    }

    return availableCategories
      .filter((cat) => cat.id !== "all")
      .map((cat) => ({
        id: cat.id,
        title: cat.label,
        description: `Peças em ${cat.label.toLowerCase()} para navegar sem cair em uma grade densa.`,
        products: products.filter((p) => p.category === cat.id).slice(0, 8),
      }))
      .filter((section) => section.products.length > 0);
  }, [activeCategory, availableCategories, filtered, products]);

  const heroProduct = curatedSections[0]?.products[0];

  return (
    <div
      className="flex flex-col overflow-hidden bg-white"
      style={maxHeight ? { height: maxHeight } : undefined}
    >
      {/* Category filter chips */}
      <div
        className="flex gap-2 overflow-x-auto border-b border-black/[0.06] px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none]"
        role="group"
        aria-label="Filtrar por categoria"
      >
        {availableCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            aria-pressed={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={clsx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              activeCategory === cat.id
                ? "bg-black text-white"
                : "border border-black/15 bg-white text-black/65 hover:border-black/30 hover:text-black"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-5">
        <HeroLook
          eyebrow={activeCategory === "all" ? "FARM Rio" : availableCategories.find((cat) => cat.id === activeCategory)?.label ?? "FARM Rio"}
          title={heroProduct ? heroProduct.name : "Descubra o próximo look"}
          description={heroProduct?.shortDescription && heroProduct.shortDescription !== "."
            ? heroProduct.shortDescription
            : "Uma exploração visual para seguir o clima da conversa com ritmo, imagem forte e menos ruído de catálogo."}
          primaryLabel="Refinar com stylist"
          onPrimaryAction={() =>
            onSearchQuery(
              activeCategory === "all"
                ? `farm rio ${heroProduct?.category ?? "vestido"} mais elegante`
                : `${availableCategories.find((cat) => cat.id === activeCategory)?.label ?? activeCategory} ${heroProduct?.tags?.[0] ?? ""}`.trim(),
              activeCategory === "all" ? undefined : activeCategory
            )
          }
        />

        <div className="pt-4">
          <RefinementChips
            label="Refinar a seleção"
            onSelect={(chip) => {
              onSearchQuery(
                `${chip}${activeCategory !== "all" ? ` ${availableCategories.find((cat) => cat.id === activeCategory)?.label ?? activeCategory}` : ""}`.trim(),
                activeCategory === "all" ? undefined : activeCategory
              );
            }}
          />
        </div>
        <AnimatePresence mode="wait">
          {curatedSections.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 text-center text-sm text-black/40"
            >
              Nenhum produto nesta categoria.
            </motion.p>
          ) : (
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-8 pt-6"
            >
              {curatedSections.map((section) => (
                <MoodboardRail
                  key={section.id}
                  title={section.title}
                  description={section.description}
                >
                  {section.products.map((p) => (
                    <div key={p.id} role="listitem" className="flex h-full w-[15rem] shrink-0">
                      <ProductCard
                        product={p}
                        variant="grid"
                        isWishlisted={wishlistIds.includes(p.id)}
                        onOpenDetail={onOpenDetail}
                        onToggleWishlist={onToggleWishlist}
                      />
                    </div>
                  ))}
                </MoodboardRail>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Empty / Error states ─────────────────────────────────────────────────────

/**
 * Cold-start state — UX Principles: explain role + offer clear next step,
 * without requiring setup before showing value.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04]">
        <ShoppingCart className="h-6 w-6 text-black/35" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-black">Farm Rio</p>
        <p className="text-xs leading-relaxed text-black/50">
          Peço para buscar produtos, explorar coleções ou montar um look.
          Exemplo: &ldquo;vestidos florais até R$400&rdquo;.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <p className="text-sm font-medium text-black">Atenção</p>
      <p className="text-xs leading-relaxed text-black/50">{message}</p>
    </div>
  );
}

// ─── Category Grid ────────────────────────────────────────────────────────────

function CategoryGrid({
  categories,
  onSearch,
}: {
  categories: CategoryInfo[];
  onSearch: (query: string, category?: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-3">
      <p className="px-4 text-xs font-medium text-black/50">Explorar por categoria</p>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none]">
        {categories.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => onSearch(cat.name, cat.name)}
            className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-black/[0.08] bg-white px-5 py-4 text-center transition-colors hover:border-black/20 hover:bg-black/[0.02] active:scale-[0.97]"
          >
            <span className="text-2xl leading-none" aria-hidden="true">{cat.emoji}</span>
            <span className="text-xs font-medium capitalize text-black">{cat.name}</span>
            {typeof cat.count === "number" ? (
              <span className="text-[10px] text-black/40">{cat.count} produto{cat.count !== 1 ? "s" : ""}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Suggestions Panel ────────────────────────────────────────────────────────

function SuggestionsPanel({
  suggestions,
  query,
  onSearch,
}: {
  suggestions: Suggestion[];
  query?: string;
  onSearch: (query: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-3">
      {query && (
        <p className="px-4 text-xs font-medium text-black/50">
          Sugestões para &ldquo;{query}&rdquo;
        </p>
      )}
      <div className="flex flex-wrap gap-2 px-4">
        {suggestions.map((s) => (
          <button
            key={s.term}
            type="button"
            onClick={() => onSearch(s.term)}
            className="flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-medium text-black transition-colors hover:border-black/20 hover:bg-black/[0.02]"
          >
            <Search className="h-3 w-3 shrink-0 text-black/30" aria-hidden="true" />
            {s.term}
            {s.type === "category" && (
              <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[9px] text-black/40">cat</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Top Searches Panel ───────────────────────────────────────────────────────

function TopSearchesPanel({
  topSearches,
  onSearch,
}: {
  topSearches: TopSearch[];
  onSearch: (query: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-black/[0.06] px-4 py-3">
        <h2 className="text-sm font-semibold text-black">Buscas em alta</h2>
      </div>
      <div className="flex flex-col divide-y divide-black/[0.05]">
        {topSearches.map((s, i) => (
          <button
            key={s.term}
            type="button"
            onClick={() => onSearch(s.term)}
            className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
          >
            <span className="w-5 text-center text-xs font-medium text-black/30">{i + 1}</span>
            <span className="flex-1 text-sm font-medium text-black">{s.term}</span>
            <span className="text-[10px] text-black/35">{s.count.toLocaleString("pt-BR")}</span>
            {s.trend === "up" && (
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-green-600" aria-label="em alta" />
            )}
            {s.trend === "down" && (
              <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-500" aria-label="em queda" />
            )}
            {s.trend === "stable" && (
              <Minus className="h-3.5 w-3.5 shrink-0 text-black/25" aria-label="estável" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Outfit Panel ─────────────────────────────────────────────────────────────

function OutfitPanel({
  anchor,
  outfitItems,
  totalOutfitPrice,
  wishlistIds,
  onAddToCart,
  onOpenDetail,
  onToggleWishlist,
}: {
  anchor: Product;
  outfitItems: Product[];
  totalOutfitPrice: number;
  wishlistIds: string[];
  onAddToCart: (product: Product, size: string) => void;
  onOpenDetail: (product: Product) => void;
  onToggleWishlist: (id: string) => void;
}) {
  const allItems = [anchor, ...outfitItems];

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-center gap-2 px-4">
        <Sparkles className="h-4 w-4 text-black/40" aria-hidden="true" />
        <p className="text-xs font-medium text-black/50">Look completo</p>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        {allItems.map((p, i) => (
          <div key={p.id} className="relative w-40 shrink-0 space-y-2">
            {i === 0 && (
              <span className="absolute -top-0.5 left-2 z-10 rounded-full bg-black px-2 py-0.5 text-[9px] font-semibold text-white">
                Principal
              </span>
            )}
            <ProductCard
              product={p}
              variant="compact"
              isWishlisted={wishlistIds.includes(p.id)}
              onOpenDetail={onOpenDetail}
              onToggleWishlist={onToggleWishlist}
            />
            <button
              type="button"
              onClick={() => {
                const directSize =
                  p.sizes.length === 1
                    ? (p.sizes[0] ?? null)
                    : p.sizes.includes("U")
                      ? "U"
                      : null;

                if (directSize) {
                  onAddToCart(p, directSize);
                  return;
                }

                onOpenDetail(p);
              }}
              className="w-full rounded-full bg-black/[0.04] px-3 py-2 text-xs font-semibold text-black/70 transition-colors hover:bg-black/[0.08] hover:text-black"
            >
              {p.sizes.length === 1 || p.sizes.includes("U") ? "Adicionar ao look" : "Escolher tamanho"}
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 pt-1">
        <p className="text-xs text-black/50">
          Total do look:{" "}
          <span className="font-semibold text-black">{brl(totalOutfitPrice)}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            const directSize =
              anchor.sizes.length === 1
                ? (anchor.sizes[0] ?? null)
                : anchor.sizes.includes("U")
                  ? "U"
                  : null;

            if (directSize) {
              onAddToCart(anchor, directSize);
              return;
            }

            onOpenDetail(anchor);
          }}
          className="flex items-center gap-0.5 text-xs font-medium text-black/55 transition-colors hover:text-black"
        >
          {anchor.sizes.length === 1 || anchor.sizes.includes("U") ? "Adicionar principal" : "Escolher tamanho"}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ─── Order History Panel ──────────────────────────────────────────────────────

const ORDER_STATUS_STYLES: Record<string, string> = {
  green: "bg-green-50 text-green-700",
  blue: "bg-blue-50 text-blue-700",
  yellow: "bg-yellow-50 text-yellow-700",
  red: "bg-red-50 text-red-500",
};

function OrderHistoryPanel({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Package className="h-8 w-8 text-black/20" aria-hidden="true" />
        <p className="text-sm text-black/50">Você ainda não tem pedidos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-black/[0.06] px-4 py-3">
        <h2 className="text-sm font-semibold text-black">
          Meus pedidos{" "}
          <span className="font-normal text-black/45">({orders.length})</span>
        </h2>
      </div>
      <div className="flex flex-col divide-y divide-black/[0.05]">
        {orders.map((order) => (
          <div key={order.id} className="flex flex-col gap-2.5 px-4 py-4">
            {/* Order header */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-black">{order.id}</p>
                <p className="text-[10px] text-black/40">
                  {new Date(order.date + "T12:00:00").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span
                className={clsx(
                  "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  ORDER_STATUS_STYLES[order.statusColor] ?? "bg-black/[0.05] text-black/50"
                )}
              >
                {order.statusLabel}
              </span>
            </div>
            {/* Product thumbnails */}
            <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none]">
              {order.items.map((item) => (
                <div key={`${item.productId}-${item.size}`} className="shrink-0">
                  <Image
                    src={item.image}
                    alt={item.productName}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <p className="mt-1 w-14 truncate text-[9px] text-black/40">
                    {item.productName}
                  </p>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-black">{brl(order.total)}</p>
              {order.trackingCode && (
                <button
                  type="button"
                  onClick={() => {
                    void window.openai?.sendFollowUpMessage?.({
                      prompt: `Como está o pedido ${order.id}? Código de rastreio: ${order.trackingCode}`,
                    });
                  }}
                  className="text-[10px] font-medium text-black/50 underline underline-offset-2 transition-colors hover:text-black"
                >
                  Rastrear {order.trackingCode}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalPendingPanel({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-xl rounded-[1.75rem] bg-[linear-gradient(180deg,#fffdf9_0%,#f6efe7_100%)] p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.06] sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-[0_10px_26px_rgba(0,0,0,0.07)] ring-1 ring-black/[0.06]">
          <Sparkles className="h-5 w-5 text-black/50" aria-hidden="true" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-black">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-black/58">{description}</p>
      </div>
    </div>
  );
}

type WishlistToastState = {
  message: string;
  saved: boolean;
  updatedAt: number;
};

function extractStructuredToolOutput(result: unknown): ToolOutput {
  if (!result || typeof result !== "object" || !("structuredContent" in result)) {
    return null;
  }

  return ((result as { structuredContent?: ToolOutput }).structuredContent ?? null) as ToolOutput;
}

function WishlistToast({
  message,
  saved,
  placement = "inline",
}: {
  message: string;
  saved: boolean;
  placement?: "inline" | "tray" | "modal";
}) {
  return (
    <div
      className={clsx(
        "pointer-events-none fixed left-1/2 z-[120] -translate-x-1/2 px-4",
        placement === "modal"
          ? "bottom-5"
          : placement === "tray"
            ? "bottom-[calc(env(safe-area-inset-bottom)+5.25rem)]"
            : "bottom-6"
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className={clsx(
          "rounded-full px-4 py-2 text-xs font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
          saved ? "bg-black text-white" : "bg-white text-black ring-1 ring-black/[0.08]"
        )}
      >
        {message}
      </motion.div>
    </div>
  );
}

// ─── Root App component ───────────────────────────────────────────────────────

function App() {
  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const isFullscreen = displayMode === "fullscreen";

  // View global — used to detect modal context and params
  const view = useOpenAiGlobal("view");
  const viewParams = view?.params;
  const isModalView = view?.mode === "modal";

  // Tool output — set after each MCP tool call
  const hostToolOutput = useOpenAiGlobal("toolOutput") as ToolOutput;

  const [activeToolOutput, setActiveToolOutput] = useState<ToolOutput>(hostToolOutput ?? null);
  const [wishlistToast, setWishlistToast] = useState<WishlistToastState | null>(null);
  const latestToolRequestRef = useRef(0);

  const toolOutput = activeToolOutput ?? hostToolOutput;
  const toolView = toolOutput?.view;

  // Persistent widget state across conversation turns
  const [widgetState, setWidgetState] =
    useWidgetState<EcommerceState>(defaultState);
  const sessionId = widgetState?.sessionId ?? "";
  const wishlistIds = widgetState?.wishlistIds ?? [];
  const activeModalView = widgetState?.activeModalView ?? null;
  const activeProduct = widgetState?.activeProduct ?? null;
  const activeOutfitPairs = widgetState?.activeOutfitPairs ?? null;
  const cartCount = widgetState?.cartCount ?? 0;
  const cartTotal = widgetState?.cartTotal ?? 0;
  const cartFeedback = widgetState?.cartFeedback ?? null;
  const styleSignals = widgetState?.styleMemory?.refinements ?? [];
  const savedLooks = widgetState?.savedLooks ?? [];

  useEffect(() => {
    if (hostToolOutput == null) {
      return;
    }

    setActiveToolOutput(hostToolOutput);
  }, [hostToolOutput]);

  useEffect(() => {
    if (!widgetState) {
      return;
    }

    persistWidgetStateLocally(widgetState);
  }, [widgetState]);

  useEffect(() => {
    if (!wishlistToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setWishlistToast(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [wishlistToast]);

  const sendStylistIntent = useCallback(
    ({
      intent,
      request,
      product,
      query,
      category,
      styleSignal,
      savedLookTitle,
      dispatchMode = "none",
    }: {
      intent: Parameters<typeof buildStylistPrompt>[0]["intent"];
      request: string;
      product?: Product;
      query?: string;
      category?: string;
      styleSignal?: string;
      savedLookTitle?: string;
      dispatchMode?: "follow-up" | "none";
    }) => {
      setWidgetState((prev) => {
        const base = prev ?? defaultState();
        const existing = base.styleMemory?.refinements ?? [];
        const nextRefinements = styleSignal
          ? [styleSignal, ...existing.filter((item) => item !== styleSignal)].slice(0, 6)
          : existing;

        return {
          ...base,
          styleMemory: {
            refinements: nextRefinements,
            lastIntent: intent,
            lastPrompt: request,
            updatedAt: Date.now(),
          },
        };
      });

      if (dispatchMode === "follow-up") {
        void window.openai?.sendFollowUpMessage?.({
          prompt: buildStylistPrompt({
            intent,
            request,
            product,
            query,
            category,
            refinements: styleSignal ? [styleSignal, ...styleSignals] : styleSignals,
            savedLookTitle,
          }),
        });
      }
    },
    [setWidgetState, styleSignals]
  );

  // ── Derived modal state ──────────────────────────────────────────────────
  const modalView = isModalView
    ? (viewParams?.view as ModalSurface | undefined)
    : null;
  const modalSurface = isModalView ? activeModalView ?? modalView : null;
  const modalProduct = isModalView
    ? (viewParams?.product as Product | undefined)
    : null;

  const setModalSurface = useCallback(
    (
      surface: ModalSurface | null,
      product: Product | null = null,
      outfitPairs: Product[] | null = null
    ) => {
      setWidgetState((prev) => {
        const base = prev ?? defaultState();
        return {
          ...base,
          activeModalView: surface,
          activeProduct: product,
          activeOutfitPairs: outfitPairs,
        };
      });
    },
    [setWidgetState]
  );

  const primeSurface = useCallback(
    (
      surface: ModalSurface | null,
      product: Product | null = null,
      outfitPairs: Product[] | null = null
    ) => {
      latestToolRequestRef.current += 1;
      setActiveToolOutput(null);
      setModalSurface(surface, product, outfitPairs);
    },
    [setModalSurface]
  );

  const syncToolStateFromOutput = useCallback(
    (nextOutput: ToolOutput) => {
      if (!nextOutput) {
        return;
      }

      setWidgetState((prev) => {
        const base = prev ?? defaultState();
        const nextState: EcommerceState = { ...base };

        if (nextOutput.view === "product-detail" && nextOutput.product) {
          nextState.activeProduct = nextOutput.product;
          nextState.activeOutfitPairs = nextOutput.outfitPairs ?? [];
        }

        if (nextOutput.view === "cart" && nextOutput.cart) {
          nextState.cartCount = nextOutput.cart.items.reduce(
            (total, item) => total + item.quantity,
            0
          );
          nextState.cartTotal = nextOutput.totals?.total ?? base.cartTotal ?? 0;
        }

        if (nextOutput.view === "wishlist" && nextOutput.wishlist) {
          nextState.wishlistIds = nextOutput.wishlist.map((product) => product.id);
        }

        return nextState;
      });
    },
    [setWidgetState]
  );

  const callCommerceTool = useCallback(
    async (
      toolName: string,
      args: Record<string, unknown>,
      options?: { displayResult?: boolean }
    ) => {
      if (!window.openai?.callTool) {
        return null;
      }

      const requestId = ++latestToolRequestRef.current;
      const response = await window.openai.callTool(toolName, args);
      const nextOutput = extractStructuredToolOutput(response);

      if (requestId !== latestToolRequestRef.current) {
        return nextOutput;
      }

      syncToolStateFromOutput(nextOutput);

      if (options?.displayResult !== false) {
        setActiveToolOutput(nextOutput);
      }

      return nextOutput;
    },
    [syncToolStateFromOutput]
  );

  // ── Wishlist toggle — optimistic client-side + server sync ───────────────
  const handleToggleWishlist = useCallback(
    (productId: string) => {
      void (async () => {
        const isRemoving = wishlistIds.includes(productId);
        const nextIds = isRemoving
          ? wishlistIds.filter((id) => id !== productId)
          : [...wishlistIds, productId];

        setWidgetState((prev) => {
          const base = prev ?? defaultState();
          return { ...base, wishlistIds: nextIds };
        });

        setWishlistToast({
          message: isRemoving ? "Removido dos favoritos" : "Salvo nos favoritos",
          saved: !isRemoving,
          updatedAt: Date.now(),
        });

        try {
          const nextOutput = await callCommerceTool(
            isRemoving ? "remove_from_wishlist" : "add_to_wishlist",
            { sessionId, productId },
            { displayResult: false }
          );

          if (nextOutput?.message) {
            setWishlistToast({
              message: nextOutput.message,
              saved: !isRemoving,
              updatedAt: Date.now(),
            });
          }
        } catch (error) {
          console.error("wishlist sync failed", error);
          setWidgetState((prev) => {
            const base = prev ?? defaultState();
            return { ...base, wishlistIds };
          });
          setWishlistToast({
            message: "Não foi possível atualizar seus favoritos agora",
            saved: false,
            updatedAt: Date.now(),
          });
        }
      })();
    },
    [callCommerceTool, sessionId, setWidgetState, wishlistIds]
  );

  // ── Open product detail in modal-first flow ─────────────────────────────
  const handleOpenDetail = useCallback(
    (product: Product) => {
      void (async () => {
        try {
          primeSurface("product-detail", product, null);
          if (!isModalView) {
            if (window.openai?.requestModal) {
              void window.openai.requestModal({
                title: product.name,
                params: { view: "product-detail", product },
              }).catch((error) => {
                console.error("open detail modal failed", error);
                void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
              });
            } else {
              void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
            }
          }
          await callCommerceTool("get_product", {
            productId: product.id,
          });
        } catch (error) {
          console.error("open detail view failed", error);
        }
      })();
    },
    [callCommerceTool, isModalView, primeSurface]
  );

  const handleOpenSavedLook = useCallback(
    (look: SavedLook) => {
      primeSurface("product-detail", look.anchor, look.supporting);

      void (async () => {
        try {
          if (!isModalView) {
            if (window.openai?.requestModal) {
              void window.openai.requestModal({
                title: look.title,
                params: { view: "product-detail", product: look.anchor },
              }).catch((error) => {
                console.error("open saved look modal failed", error);
                void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
              });
            } else {
              void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
            }
          }
          await callCommerceTool("get_product", {
            productId: look.anchor.id,
          });
        } catch (error) {
          console.error("open saved look failed", error);
        }
      })();
    },
    [callCommerceTool, isModalView, primeSurface]
  );

  const handleCloseDetail = useCallback(() => {
    primeSurface(null, null, null);
    if (isModalView) {
      void window.openai?.requestClose?.();
    }
  }, [isModalView, primeSurface]);

  // ── Add to cart — calls server tool ─────────────────────────────────────
  const handleAddToCart = useCallback(
    (product: Product, size: string) => {
      const displayResult = activeModalView === "cart";
      void (async () => {
        try {
          const nextOutput = await callCommerceTool(
            "add_to_cart",
            {
              sessionId,
              productId: product.id,
              size,
              quantity: 1,
            },
            { displayResult }
          );

          if (nextOutput?.view === "cart" && nextOutput.cart) {
            setWidgetState((prev) => {
              const base = prev ?? defaultState();
              return {
                ...base,
                cartFeedback: {
                  productId: product.id,
                  productName: product.name,
                  size,
                  addedAt: Date.now(),
                },
              };
            });
          }
        } catch (error) {
          console.error("add to cart failed", error);
        }
      })();
    },
    [activeModalView, callCommerceTool, sessionId, setWidgetState]
  );

  // ── Update cart item quantity ────────────────────────────────────────────
  const handleUpdateQuantity = useCallback(
    (productId: string, size: string, delta: number) => {
      void callCommerceTool(
        "update_item_quantity",
        {
          sessionId,
          productId,
          size,
          delta,
        },
        { displayResult: true }
      );
    },
    [callCommerceTool, sessionId]
  );

  const handleCheckout = useCallback((cart: Cart) => {
    if (cart.items.length === 0) {
      return;
    }

    const baseHref = cart.items.find((item) => item.product.url)?.product.url;
    const storeOrigin = (() => {
      if (!baseHref) {
        return "https://www.farmrio.com.br";
      }

      try {
        return new URL(baseHref).origin;
      } catch {
        return "https://www.farmrio.com.br";
      }
    })();

    const checkoutUrl = new URL("/checkout/cart/add", storeOrigin);
    for (const item of cart.items) {
      const sku = item.product.sizeSkuMap?.[item.size] || item.product.sku || item.product.productID;
      if (!sku) {
        continue;
      }

      checkoutUrl.searchParams.append("sku", sku);
      checkoutUrl.searchParams.append("qty", String(item.quantity));
      checkoutUrl.searchParams.append("seller", "1");
    }
    checkoutUrl.searchParams.set("redirect", "true");
    checkoutUrl.searchParams.set("sc", "1");

    const href = checkoutUrl.toString();
    if (window.openai?.openExternal) {
      void Promise.resolve(window.openai.openExternal({ href })).catch((error: unknown) => {
        console.error("open checkout failed", error);
        window.open(href, "_blank", "noopener,noreferrer");
      });
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
  }, []);

  const handleOpenCart = useCallback(() => {
    primeSurface("cart", null, null);
    void (async () => {
      try {
        if (!isModalView) {
          if (window.openai?.requestModal) {
            void window.openai.requestModal({
              title: "Seu look",
              params: { view: "cart" },
            }).catch((error) => {
              console.error("open cart modal failed", error);
              void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
            });
          } else {
            void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
          }
        }
        await callCommerceTool("view_cart", { sessionId }, { displayResult: true });
      } catch (error) {
        console.error("open cart flow failed", error);
      }
    })();
  }, [callCommerceTool, isModalView, primeSurface, sessionId]);

  const handleOpenWishlist = useCallback(() => {
    primeSurface("wishlist", null, null);
    void (async () => {
      try {
        if (!isModalView) {
          if (window.openai?.requestModal) {
            void window.openai.requestModal({
              title: "Favoritos",
              params: { view: "wishlist" },
            }).catch((error) => {
              console.error("open wishlist modal failed", error);
              void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
            });
          } else {
            void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
          }
        }
        await callCommerceTool("view_wishlist", { sessionId }, { displayResult: true });
      } catch (error) {
        console.error("open wishlist flow failed", error);
      }
    })();
  }, [callCommerceTool, isModalView, primeSurface, sessionId]);

  const handleAskForOutfit = useCallback((product: Product) => {
    primeSurface("outfit", null, null);
    sendStylistIntent({
      intent: "style-product",
      request: `Monte um look FARM Rio com a peça ${product.name}`,
      product,
      styleSignal: product.tags[0],
      dispatchMode: "none",
    });
    void callCommerceTool("recommend_outfit", { productId: product.id }, { displayResult: true });
  }, [callCommerceTool, primeSurface, sendStylistIntent]);

  const handleAskStylist = useCallback(() => {
    primeSurface("product-list", null, null);
    sendStylistIntent({
      intent: "adjust-cart",
      request: "Ajuste meu look e sugira a próxima combinação ideal",
      styleSignal: styleSignals[0],
      dispatchMode: "none",
    });
    void callCommerceTool(
      "search_products",
      {
        query: `look farm rio ${styleSignals[0] ?? "elegante"}`,
      },
      { displayResult: true }
    );
  }, [callCommerceTool, primeSurface, sendStylistIntent, styleSignals]);

  const handleRefineResults = useCallback(
    (chip: string, query?: string) => {
      primeSurface("product-list", null, null);
      sendStylistIntent({
        intent: "refine-results",
        request: `${chip}${query ? ` para ${query}` : ""}`,
        query,
        styleSignal: chip,
        dispatchMode: "none",
      });
      void callCommerceTool(
        "search_products",
        {
          query: `${query ? `${query} ` : ""}${chip}`.trim(),
        },
        { displayResult: true }
      );
    },
    [callCommerceTool, primeSurface, sendStylistIntent]
  );

  const handleRefineProduct = useCallback(
    (chip: string, product: Product) => {
      primeSurface("product-list", null, null);
      sendStylistIntent({
        intent: "refine-product",
        request: `${chip} com ${product.name}`,
        product,
        styleSignal: chip,
        dispatchMode: "none",
      });
      void callCommerceTool(
        "search_products",
        {
          query: `${chip} ${product.category} ${product.tags.slice(0, 2).join(" ")}`.trim(),
        },
        { displayResult: true }
      );
    },
    [callCommerceTool, primeSurface, sendStylistIntent]
  );

  const handleContinueWithStylist = useCallback(
    (suggestion: string, product?: Product) => {
      primeSurface("product-list", null, null);
      sendStylistIntent({
        intent: "continue-look",
        request: suggestion,
        product,
        styleSignal: suggestion,
        dispatchMode: "none",
      });
      void callCommerceTool(
        "search_products",
        {
          query: `${suggestion} ${product?.category ?? "farm rio"} ${product?.tags?.slice(0, 2).join(" ") ?? ""}`.trim(),
        },
        { displayResult: true }
      );
    },
    [callCommerceTool, primeSurface, sendStylistIntent]
  );

  const handleEditorialPrompt = useCallback(
    (prompt: string, product: Product) => {
      primeSurface("product-list", null, null);
      sendStylistIntent({
        intent: "discover",
        request: prompt,
        product,
        dispatchMode: "none",
      });
      void callCommerceTool(
        "search_products",
        {
          query: `${prompt} ${product.category}`,
        },
        { displayResult: true }
      );
    },
    [callCommerceTool, primeSurface, sendStylistIntent]
  );

  const handleSearchQuery = useCallback(
    (query: string, category?: string) => {
      primeSurface("product-list", null, null);
      sendStylistIntent({
        intent: "discover",
        request: query,
        query,
        category,
        dispatchMode: "none",
      });
      void callCommerceTool(
        "search_products",
        {
          query,
          ...(category ? { category } : {}),
        },
        { displayResult: true }
      );
    },
    [callCommerceTool, primeSurface, sendStylistIntent]
  );

  const handleSaveLook = useCallback(
    (product: Product, relatedProducts: Product[]) => {
      setWidgetState((prev) => {
        const base = prev ?? defaultState();
        const existing = base.savedLooks ?? [];
        const lookId = `look-${product.id}`;
        if (existing.some((look) => look.id === lookId)) {
          return base;
        }

        const nextLook: SavedLook = {
          id: lookId,
          title: product.name,
          note: relatedProducts[0]
            ? `Com ${relatedProducts[0].name} e mais ${Math.max(relatedProducts.length - 1, 0)} escolha${relatedProducts.length - 1 === 1 ? "" : "s"}`
            : "Look salvo a partir da peça principal",
          anchor: product,
          supporting: relatedProducts.slice(0, 4),
          createdAt: Date.now(),
        };

        return {
          ...base,
          savedLooks: [nextLook, ...existing].slice(0, 8),
        };
      });

      sendStylistIntent({
        intent: "saved-look",
        request: `Salvei o look ${product.name} para retomar depois`,
        product,
        savedLookTitle: product.name,
        dispatchMode: "none",
      });
    },
    [sendStylistIntent, setWidgetState]
  );

  const wrapWithTray = useCallback(
    (content: ReactElement) => (
      <>
        {content}
        <AnimatePresence>
          {wishlistToast ? <WishlistToast message={wishlistToast.message} saved={wishlistToast.saved} placement={cartCount > 0 || wishlistIds.length > 0 ? "tray" : "inline"} /> : null}
        </AnimatePresence>
        <MiniCartBar
          cartCount={cartCount}
          cartTotal={cartTotal}
          favoritesCount={wishlistIds.length}
          cartFeedback={cartFeedback}
          onOpenCart={handleOpenCart}
          onOpenWishlist={handleOpenWishlist}
          onAskStylist={handleAskStylist}
        />
      </>
    ),
    [cartCount, cartFeedback, cartTotal, handleAskStylist, handleOpenCart, handleOpenWishlist, wishlistIds.length, wishlistToast]
  );

  // ── Expand to fullscreen — used by "Ver todos" ───────────────────────────
  const handleSeeAll = useCallback(() => {
    void window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
  }, []);

  const panelScrollStyle = maxHeight
    ? {
        height: Math.max(maxHeight - 12, 440),
        overflowY: "auto" as const,
        overscrollBehavior: "contain" as const,
      }
    : undefined;

  const wrapModalContent = useCallback(
    (content: ReactElement, options?: { showClose?: boolean }) => (
      <>
        <div
          className="min-h-full bg-[linear-gradient(180deg,#fbf8f2_0%,#ffffff_24%,#ffffff_100%)]"
          style={panelScrollStyle}
        >
          {options?.showClose ? (
            <div className="sticky top-0 z-20 flex justify-end px-3 pt-3 sm:px-4">
              <button
                type="button"
                onClick={handleCloseDetail}
                className="inline-flex items-center rounded-full bg-white/92 px-3 py-2 text-xs font-semibold text-black shadow-[0_12px_30px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] backdrop-blur-md transition-colors hover:bg-white"
              >
                Fechar
              </button>
            </div>
          ) : null}
          {content}
        </div>
        <AnimatePresence>
          {wishlistToast ? <WishlistToast message={wishlistToast.message} saved={wishlistToast.saved} placement="modal" /> : null}
        </AnimatePresence>
      </>
    ),
    [handleCloseDetail, panelScrollStyle, wishlistToast]
  );

  // ── Modal rendering ──────────────────────────────────────────────────────
  if (isModalView) {
    const detailProduct = activeProduct ?? modalProduct ?? toolOutput?.product ?? null;

    if (toolView === "product-not-found") {
      return wrapModalContent(
        <div>
          <ErrorState message="Esta peça não está mais disponível. Abra outra opção da seleção para continuar." />
        </div>
      );
    }

    if (toolView === "cart-error") {
      return wrapModalContent(
        <div>
          <ErrorState message={toolOutput?.message ?? toolOutput?.error ?? "Não consegui atualizar o carrinho agora. Tente novamente."} />
        </div>
      );
    }

    if (modalSurface === "cart") {
      if (toolOutput?.cart && toolOutput?.totals) {
        return wrapModalContent(
          <div>
            <CartPanel
              cart={toolOutput.cart}
              totals={toolOutput.totals}
              savedLooks={savedLooks}
              styleSignals={styleSignals}
              onOpenSavedLook={handleOpenSavedLook}
              onCheckout={handleCheckout}
              onContinueWithStylist={(suggestion) => handleContinueWithStylist(suggestion)}
              onUpdateQuantity={handleUpdateQuantity}
            />
          </div>
        );
      }

      return wrapModalContent(
        <div>
          <ModalPendingPanel
            eyebrow="Carrinho"
            title="Atualizando seu look"
            description="Estou trazendo as peças adicionadas e recalculando os totais para manter o carrinho consistente."
          />
        </div>
      );
    }

    if (modalSurface === "outfit") {
      if (toolOutput?.anchor && toolOutput?.outfitItems) {
        return wrapModalContent(
          <div>
            <OutfitPanel
              anchor={toolOutput.anchor}
              outfitItems={toolOutput.outfitItems}
              totalOutfitPrice={toolOutput.totalOutfitPrice ?? toolOutput.anchor.price}
              wishlistIds={wishlistIds}
              onAddToCart={handleAddToCart}
              onOpenDetail={handleOpenDetail}
              onToggleWishlist={handleToggleWishlist}
            />
          </div>
        );
      }

      return wrapModalContent(
        <div>
          <ModalPendingPanel
            eyebrow="Stylist FARM Rio"
            title="Montando as combinações"
            description="Estou cruzando a peça principal com complementos e proporções para abrir um look mais coerente no mesmo fluxo."
          />
        </div>
      );
    }

    if (modalSurface === "product-list") {
      if (toolOutput?.products) {
        return wrapModalContent(
          <div>
            <ProductCarousel
              products={toolOutput.products}
              wishlistIds={wishlistIds}
              wishlistCount={wishlistIds.length}
              query={toolOutput.query}
              totalFound={toolOutput.totalFound}
              styleSignals={styleSignals}
              onRefine={handleRefineResults}
              onOpenDetail={handleOpenDetail}
              onOpenWishlist={handleOpenWishlist}
              onToggleWishlist={handleToggleWishlist}
              onSeeAll={handleSeeAll}
            />
          </div>
        );
      }

      return wrapModalContent(
        <div>
          <ModalPendingPanel
            eyebrow="Curadoria"
            title="Buscando novas peças"
            description="Estou refinando a busca com base no seu pedido para abrir uma seleção mais próxima do que você quer agora."
          />
        </div>
      );
    }

    if (modalSurface === "product-detail" && detailProduct) {
      return wrapModalContent(
        <div>
          <ProductDetailPanel
            product={detailProduct}
            relatedProducts={activeOutfitPairs ?? toolOutput?.outfitPairs ?? []}
            wishlistIds={wishlistIds}
            cartCount={cartCount}
            cartFeedback={cartFeedback}
            styleSignals={styleSignals}
            savedLooks={savedLooks}
            isLookSaved={savedLooks.some((look) => look.anchor.id === detailProduct.id)}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onAskForOutfit={handleAskForOutfit}
            onEditorialPrompt={handleEditorialPrompt}
            onRefineLook={handleRefineProduct}
            onContinueWithStylist={handleContinueWithStylist}
            onSaveLook={handleSaveLook}
            onOpenSavedLook={handleOpenSavedLook}
            onOpenCart={handleOpenCart}
            onOpenWishlist={handleOpenWishlist}
            onOpenDetail={handleOpenDetail}
            onClose={handleCloseDetail}
          />
        </div>,
        { showClose: false }
      );
    }

    if (modalSurface === "wishlist") {
      if (toolOutput?.wishlist) {
        return wrapModalContent(
          <div>
            <WishlistPanel
              wishlist={toolOutput.wishlist}
              wishlistIds={wishlistIds}
              onOpenDetail={handleOpenDetail}
              onToggleWishlist={handleToggleWishlist}
            />
          </div>
        );
      }

      return wrapModalContent(
        <div>
          <ModalPendingPanel
            eyebrow="Favoritos"
            title="Carregando seus salvos"
            description="Estou trazendo as peças favoritas da sua sessão para você retomar a seleção sem perder o contexto."
          />
        </div>
      );
    }
    return null;
  }

  // ── Fullscreen rendering ─────────────────────────────────────────────────
  if (isFullscreen) {
    if (activeProduct) {
      return (
        <>
          <div
            className="bg-white"
            style={maxHeight ? { height: maxHeight, overflowY: "auto" } : undefined}
          >
            <ProductDetailPanel
              product={activeProduct}
              relatedProducts={activeOutfitPairs ?? []}
              wishlistIds={wishlistIds}
              cartCount={cartCount}
              cartFeedback={cartFeedback}
              styleSignals={styleSignals}
              savedLooks={savedLooks}
              isLookSaved={savedLooks.some((look) => look.anchor.id === activeProduct.id)}
              immersive
              onToggleWishlist={handleToggleWishlist}
              onAddToCart={handleAddToCart}
              onAskForOutfit={handleAskForOutfit}
              onEditorialPrompt={handleEditorialPrompt}
              onRefineLook={handleRefineProduct}
              onContinueWithStylist={handleContinueWithStylist}
              onSaveLook={handleSaveLook}
              onOpenSavedLook={handleOpenSavedLook}
              onOpenCart={handleOpenCart}
              onOpenWishlist={handleOpenWishlist}
              onOpenDetail={handleOpenDetail}
              onClose={handleCloseDetail}
            />
          </div>
          <AnimatePresence>
              {wishlistToast ? <WishlistToast message={wishlistToast.message} saved={wishlistToast.saved} placement="inline" /> : null}
          </AnimatePresence>
        </>
      );
    }

      if (toolView === "wishlist" && toolOutput?.wishlist) {
        return (
          <div
            className="bg-white"
            style={maxHeight ? { height: maxHeight, overflowY: "auto" } : undefined}
          >
            <WishlistPanel
              wishlist={toolOutput.wishlist}
              wishlistIds={wishlistIds}
              onOpenDetail={handleOpenDetail}
              onToggleWishlist={handleToggleWishlist}
            />
          </div>
        );
      }

    if (toolView === "cart" && toolOutput?.cart && toolOutput?.totals) {
      return (
        <div
          className="bg-white"
          style={maxHeight ? { height: maxHeight, overflowY: "auto" } : undefined}
        >
          <CartPanel
            cart={toolOutput.cart}
            totals={toolOutput.totals}
            message={toolOutput.message}
            couponError={toolOutput.couponError}
            vendorError={toolOutput.vendorError}
            shippingInfo={toolOutput.shippingInfo}
            savedLooks={savedLooks}
            styleSignals={styleSignals}
            onOpenSavedLook={handleOpenSavedLook}
            onCheckout={handleCheckout}
            onContinueWithStylist={(suggestion) => handleContinueWithStylist(suggestion)}
            onUpdateQuantity={handleUpdateQuantity}
          />
        </div>
      );
    }

    const products =
      toolOutput?.products ??
      (toolOutput?.product ? [toolOutput.product] : []);
    if (products.length === 0) {
      return (
        <div
          className="flex items-center justify-center bg-white"
          style={maxHeight ? { height: maxHeight } : undefined}
        >
          <EmptyState />
        </div>
      );
    }
    return (
      wrapWithTray(
        <FullscreenGrid
          products={products}
          wishlistIds={wishlistIds}
          onOpenDetail={handleOpenDetail}
          onSearchQuery={handleSearchQuery}
          onToggleWishlist={handleToggleWishlist}
        />
      )
    );
  }

  // ── Inline rendering — driven by toolOutput.view ─────────────────────────
  const scrollStyle = maxHeight
    ? { maxHeight, overflowY: "auto" as const }
    : undefined;

  if (toolView === "product-list" && toolOutput?.products?.length) {
    return (
      wrapWithTray(
        <ProductCarousel
          products={toolOutput.products}
          wishlistIds={wishlistIds}
          wishlistCount={wishlistIds.length}
          query={toolOutput.query}
          totalFound={toolOutput.totalFound}
          styleSignals={styleSignals}
          onRefine={handleRefineResults}
          onOpenDetail={handleOpenDetail}
          onOpenWishlist={handleOpenWishlist}
          onToggleWishlist={handleToggleWishlist}
          onSeeAll={handleSeeAll}
        />
      )
    );
  }

  if (toolView === "categories" && toolOutput?.categories?.length) {
    return wrapWithTray(<CategoryGrid categories={toolOutput.categories} onSearch={handleSearchQuery} />);
  }

  if (toolView === "suggestions" && toolOutput?.suggestions?.length) {
    return wrapWithTray(
      <SuggestionsPanel
        suggestions={toolOutput.suggestions}
        query={toolOutput.query}
        onSearch={handleSearchQuery}
      />
    );
  }

  if (toolView === "top-searches" && toolOutput?.topSearches?.length) {
    return wrapWithTray(<TopSearchesPanel topSearches={toolOutput.topSearches} onSearch={handleSearchQuery} />);
  }

  if (
    toolView === "outfit" &&
    toolOutput?.anchor &&
    toolOutput?.outfitItems
  ) {
    return (
      wrapWithTray(
        <OutfitPanel
          anchor={toolOutput.anchor}
          outfitItems={toolOutput.outfitItems}
          totalOutfitPrice={toolOutput.totalOutfitPrice ?? toolOutput.anchor.price}
          wishlistIds={wishlistIds}
          onAddToCart={handleAddToCart}
          onOpenDetail={handleOpenDetail}
          onToggleWishlist={handleToggleWishlist}
        />
      )
    );
  }

  if (toolView === "orders") {
    return (
      wrapWithTray(
        <div style={scrollStyle}>
          <OrderHistoryPanel orders={toolOutput?.orders ?? []} />
        </div>
      )
    );
  }

  if (toolView === "product-detail" && toolOutput?.product) {
    const detailProduct = toolOutput.product;
    return (
      wrapWithTray(
        <div style={scrollStyle}>
          <ProductDetailPanel
            product={detailProduct}
            relatedProducts={toolOutput.outfitPairs ?? []}
            wishlistIds={wishlistIds}
            cartCount={cartCount}
            cartFeedback={cartFeedback}
            styleSignals={styleSignals}
            savedLooks={savedLooks}
            isLookSaved={savedLooks.some((look) => look.anchor.id === detailProduct.id)}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onAskForOutfit={handleAskForOutfit}
            onEditorialPrompt={handleEditorialPrompt}
            onRefineLook={handleRefineProduct}
            onContinueWithStylist={handleContinueWithStylist}
            onSaveLook={handleSaveLook}
            onOpenSavedLook={handleOpenSavedLook}
            onOpenCart={handleOpenCart}
            onOpenWishlist={handleOpenWishlist}
            onOpenDetail={handleOpenDetail}
          />
        </div>
      )
    );
  }

  if (toolView === "cart" && toolOutput?.cart && toolOutput?.totals) {
    return (
      wrapWithTray(
        <div style={scrollStyle}>
          <CartPanel
            cart={toolOutput.cart}
            totals={toolOutput.totals}
            message={toolOutput.message}
            couponError={toolOutput.couponError}
            vendorError={toolOutput.vendorError}
            shippingInfo={toolOutput.shippingInfo}
            savedLooks={savedLooks}
            styleSignals={styleSignals}
            onOpenSavedLook={handleOpenSavedLook}
            onCheckout={handleCheckout}
            onContinueWithStylist={(suggestion) => handleContinueWithStylist(suggestion)}
            onUpdateQuantity={handleUpdateQuantity}
          />
        </div>
      )
    );
  }

  if (toolView === "wishlist" && toolOutput?.wishlist) {
    return (
      wrapWithTray(
        <div style={scrollStyle}>
          <WishlistPanel
            wishlist={toolOutput.wishlist}
            wishlistIds={wishlistIds}
            onOpenDetail={handleOpenDetail}
            onToggleWishlist={handleToggleWishlist}
          />
        </div>
      )
    );
  }

  if (
    toolView === "product-not-found" ||
    toolView === "cart-error" ||
    (toolOutput?.error != null) ||
    (toolOutput?.message != null && toolView?.startsWith("error"))
  ) {
    return (
      <ErrorState
        message={
          toolView === "product-not-found"
            ? "Esta peça não está mais disponível. Tente outra opção da seleção."
            :
          toolOutput?.message ??
          toolOutput?.error ??
          "Ocorreu um erro. Tente novamente."
        }
      />
    );
  }

  // Cold-start / default
  return wrapWithTray(<EmptyState />);
}

// ─── Mount ────────────────────────────────────────────────────────────────────

// Named + default exports expected by the build-all.mts virtual-entry wrapper
export { App };
export default App;

const root = document.getElementById("ecommerce-shop-root");
if (root) {
  createRoot(root).render(<App />);
}
