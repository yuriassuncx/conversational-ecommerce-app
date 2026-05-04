import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { brl, installmentLabel } from "../../format";
import type { CartFeedback, Product, SavedLook } from "../../types";
import { FollowUpSuggestions } from "../conversation/FollowUpSuggestions";
import { RefinementChips } from "../conversation/RefinementChips";
import { StyleMemoryPanel } from "../conversation/StyleMemoryPanel";
import { OutfitStory } from "../editorial/OutfitStory";
import { SavedLooksRail } from "../editorial/SavedLooksRail";
import { EditorialBanner } from "./EditorialBanner";
import { MiniCart } from "./MiniCart";
import { OutfitSuggestion } from "./OutfitSuggestion";
import { ProductHero } from "./ProductHero";
import { ProductRail } from "./ProductRail";
import { RelatedProducts } from "./RelatedProducts";
import { StickyCheckout } from "./StickyCheckout";

export function ProductDetailPanel({
  product,
  relatedProducts = [],
  wishlistIds,
  cartCount,
  cartFeedback,
  styleSignals = [],
  savedLooks = [],
  isLookSaved = false,
  immersive = false,
  onToggleWishlist,
  onAddToCart,
  onAskForOutfit,
  onEditorialPrompt,
  onRefineLook,
  onContinueWithStylist,
  onSaveLook,
  onOpenSavedLook,
  onOpenCart,
  onOpenWishlist,
  onOpenDetail,
  onClose,
}: {
  product: Product;
  relatedProducts?: Product[];
  wishlistIds: string[];
  cartCount: number;
  cartFeedback?: CartFeedback | null;
  styleSignals?: string[];
  savedLooks?: SavedLook[];
  isLookSaved?: boolean;
  immersive?: boolean;
  onToggleWishlist: (id: string) => void;
  onAddToCart: (product: Product, size: string) => void;
  onAskForOutfit: (product: Product) => void;
  onEditorialPrompt: (prompt: string, product: Product) => void;
  onRefineLook: (chip: string, product: Product) => void;
  onContinueWithStylist: (suggestion: string, product: Product) => void;
  onSaveLook: (product: Product, relatedProducts: Product[]) => void;
  onOpenSavedLook: (look: SavedLook) => void;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  onOpenDetail: (product: Product) => void;
  onClose?: () => void;
}) {
  const defaultSize = product.sizes.length === 1 ? (product.sizes[0] ?? null) : null;
  const [selectedSize, setSelectedSize] = useState<string | null>(defaultSize);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  useEffect(() => {
    setSelectedSize(product.sizes.length === 1 ? (product.sizes[0] ?? null) : null);
    setGalleryIdx(0);
  }, [product]);

  const images = useMemo(
    () => [product.image, ...(product.gallery ?? [])].filter(Boolean),
    [product.gallery, product.image]
  );
  const isWishlisted = wishlistIds.includes(product.id);
  const canAdd = selectedSize !== null;
  const showSizeSelector =
    product.sizes.length > 0 &&
    !(product.sizes.length === 1 && product.sizes[0] === "U");
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0;
  const installmentText =
    product.installments && product.installments.count > 1
      ? installmentLabel(product.installments)
      : undefined;

  useEffect(() => {
    if (cartFeedback?.productId !== product.id) {
      return;
    }

    setFeedbackVisible(true);
    const timeoutId = window.setTimeout(() => {
      setFeedbackVisible(false);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cartFeedback, product.id]);

  const sizeItems = product.sizes.map((size) => ({
    id: size,
    label: size,
    meta: selectedSize === size ? "Selecionado" : "Disponível",
  }));

  return (
    <section className={clsx("flex min-h-full flex-col", immersive ? "bg-[linear-gradient(180deg,#f8f5ef_0%,#ffffff_32%,#ffffff_100%)]" : "bg-white") }>
      <div className="sticky top-0 z-20 px-3 pt-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full bg-white/84 px-3 py-2 text-xs font-medium text-black shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md transition-colors hover:bg-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar
            </button>
          ) : (
            <div />
          )}
          <MiniCart
            cartCount={cartCount}
            favoritesCount={wishlistIds.length}
            cartFeedback={cartFeedback}
            onOpenCart={onOpenCart}
            onOpenWishlist={onOpenWishlist}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[72rem] flex-1 flex-col gap-6 px-3 pb-32 pt-3 sm:px-5 lg:flex-row lg:gap-8 lg:px-8 lg:pb-40">
        <div className="w-full space-y-4 lg:w-[56%]">
          <ProductHero
            name={product.name}
            brand={product.brand}
            images={images}
            galleryIdx={galleryIdx}
            onSelectImage={setGalleryIdx}
            discount={discount}
            isWishlisted={isWishlisted}
            onToggleWishlist={() => onToggleWishlist(product.id)}
          />
          {showSizeSelector ? (
            <ProductRail title="Escolha o tamanho" items={sizeItems} activeId={selectedSize ?? ""} onSelect={setSelectedSize} />
          ) : null}
        </div>

        <div className="w-full space-y-5 lg:w-[44%] lg:pt-6">
          <EditorialBanner
            product={product}
            onPromptSelect={(prompt) => {
              onEditorialPrompt(prompt, product);
            }}
          />

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/35">
                {product.brand}
              </p>
              <h1 className="text-[2rem] font-medium leading-[1.02] tracking-[-0.03em] text-black sm:text-[2.5rem]">
                {product.name}
              </h1>
              <p className="text-sm text-black/45">{product.color}</p>
            </div>

            <div className="space-y-1">
              {product.compareAtPrice && product.compareAtPrice > product.price ? (
                <p className="text-sm text-black/28 line-through">{brl(product.compareAtPrice)}</p>
              ) : null}
              <p className="text-2xl font-semibold text-black">{brl(product.price)}</p>
              {installmentText ? <p className="text-sm text-black/50">{installmentText}</p> : null}
            </div>

            <p className="max-w-[34rem] text-[15px] leading-7 text-black/68">
              {product.shortDescription && product.shortDescription !== "."
                ? product.shortDescription
                : product.description}
            </p>

            {product.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[11px] font-medium text-black/55"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <OutfitSuggestion product={product} onAskForOutfit={onAskForOutfit} />

          <OutfitStory
            product={product}
            relatedProducts={relatedProducts}
            styleSignals={styleSignals}
          />

          <div className="flex items-center justify-between gap-3 rounded-[1.5rem] bg-black/[0.03] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
                Look atual
              </p>
              <p className="text-sm leading-6 text-black/60">
                Salve esta combinação para retomar mais tarde no mesmo fluxo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSaveLook(product, relatedProducts)}
              className="shrink-0 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.01]"
            >
              {isLookSaved ? "Look salvo" : "Salvar look"}
            </button>
          </div>

          <StyleMemoryPanel refinements={styleSignals} lastIntent="refinamentos recentes" />

          <RefinementChips
            label="Refine o look"
            chips={[
              "mais elegante",
              "mais leve",
              "menos estampado",
              "para jantar em Trancoso",
              "resort chic",
            ]}
            onSelect={(chip) => {
              onRefineLook(chip, product);
            }}
          />

          <RelatedProducts products={relatedProducts} onOpenDetail={onOpenDetail} />

          <SavedLooksRail looks={savedLooks} onOpenLook={onOpenSavedLook} />

          <FollowUpSuggestions
            title="Continuar com o stylist"
            suggestions={[
              "Quer uma bolsa que combine?",
              "Posso montar o look completo.",
              "Quer versões mais elegantes?",
              "Quer algo parecido mais leve?",
            ]}
            onSelect={(suggestion) => {
              onContinueWithStylist(suggestion, product);
            }}
          />
        </div>
      </div>

      <StickyCheckout
        selectedSize={selectedSize}
        canAdd={canAdd}
        cartCount={cartCount}
        primaryLabel={canAdd ? "Adicionar ao carrinho" : "Selecione um tamanho"}
        priceLabel={brl(product.price)}
        installmentText={installmentText}
        feedbackVisible={feedbackVisible}
        onAskForStyling={() => onAskForOutfit(product)}
        onOpenCart={onOpenCart}
        onAddToCart={() => {
          if (!selectedSize) return;
          setFeedbackVisible(true);
          onAddToCart(product, selectedSize);
        }}
      />
    </section>
  );
}