import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@openai/apps-sdk-ui/components/Button";

export function StickyCheckout({
  selectedSize,
  canAdd,
  cartCount,
  primaryLabel,
  priceLabel,
  installmentText,
  feedbackVisible,
  onAskForStyling,
  onAddToCart,
  onOpenCart,
}: {
  selectedSize: string | null;
  canAdd: boolean;
  cartCount: number;
  primaryLabel: string;
  priceLabel: string;
  installmentText?: string;
  feedbackVisible: boolean;
  onAskForStyling: () => void;
  onAddToCart: () => void;
  onOpenCart: () => void;
}) {
  const showStylistAction = feedbackVisible || canAdd;
  const showCartAction = cartCount > 0;

  return (
    <div className="sticky bottom-0 z-20 border-t border-black/[0.06] bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-3 backdrop-blur-xl sm:px-6">
      <AnimatePresence>
        {feedbackVisible ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="pb-3 text-xs font-medium text-black/55"
          >
            Adicionado ao look. Você pode revisar o carrinho ou seguir refinando a combinação.
          </motion.p>
        ) : null}
      </AnimatePresence>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
            {selectedSize ? `Tamanho ${selectedSize}` : "Selecione um tamanho"}
          </p>
          <p className="text-base font-semibold text-black">{priceLabel}</p>
          {installmentText ? <p className="text-xs text-black/45">{installmentText}</p> : null}
        </div>
        <div className="grid w-full gap-2 sm:w-[19rem]">
          <Button type="button" variant="solid" color="primary" size="md" block disabled={!canAdd} onClick={onAddToCart}>
            {primaryLabel}
          </Button>
          {(showStylistAction || showCartAction) ? (
            <div className={clsx("grid gap-2", showStylistAction && showCartAction ? "grid-cols-2" : "grid-cols-1")}>
              {showStylistAction ? (
                <button
                  type="button"
                  onClick={onAskForStyling}
                  className="rounded-full border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-black/68 transition-colors hover:border-black/[0.14] hover:bg-[#f6eee5] hover:text-black"
                >
                  Montar look com IA
                </button>
              ) : null}
              {showCartAction ? (
                <button
                  type="button"
                  onClick={onOpenCart}
                  className="rounded-full border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-black/68 transition-colors hover:border-black/[0.14] hover:bg-[#f6eee5] hover:text-black"
                >
                  Ver look
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}