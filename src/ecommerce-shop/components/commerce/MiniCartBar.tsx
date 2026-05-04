import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";

import { brl } from "../../format";
import type { CartFeedback } from "../../types";

export function MiniCartBar({
  cartCount,
  cartTotal,
  favoritesCount,
  cartFeedback,
  onOpenCart,
  onOpenWishlist,
  onAskStylist,
}: {
  cartCount: number;
  cartTotal: number;
  favoritesCount: number;
  cartFeedback?: CartFeedback | null;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  onAskStylist: () => void;
}) {
  if (cartCount <= 0 && favoritesCount <= 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22 }}
        className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-[1.75rem] bg-black px-4 py-3 text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            {cartCount > 0 ? "Seu look" : "Favoritos"}
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={cartFeedback ? `${cartFeedback.productId}-${cartFeedback.addedAt}` : `tray-${cartCount}-${cartTotal}-${favoritesCount}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="truncate text-sm font-medium text-white"
            >
              {cartCount > 0
                ? cartFeedback
                ? `${cartFeedback.productName} entrou no look`
                : `${cartCount} ${cartCount === 1 ? "peça" : "peças"} selecionadas`
                : `${favoritesCount} ${favoritesCount === 1 ? "peça salva" : "peças salvas"}`}
            </motion.p>
          </AnimatePresence>
          </div>
          {cartCount > 0 ? (
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Total</p>
              <p className="text-sm font-semibold text-white">{brl(cartTotal)}</p>
            </div>
          ) : null}
        </div>
        <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            type="button"
            onClick={onOpenWishlist}
            className={clsx(
              "rounded-full px-3 py-2 text-xs font-semibold transition-colors",
              favoritesCount > 0
                ? "bg-white/12 text-white hover:bg-white/18"
                : "hidden"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5" aria-hidden="true" />
              Favoritos {favoritesCount > 0 ? `(${favoritesCount})` : ""}
            </span>
          </button>
          <button
            type="button"
            onClick={onAskStylist}
            className="rounded-full bg-white/12 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/18"
          >
            <span className="sm:hidden">Stylist</span>
            <span className="hidden sm:inline">Ajustar com stylist</span>
          </button>
          {cartCount > 0 ? (
            <button
              type="button"
              onClick={onOpenCart}
              className={clsx("col-span-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black transition-transform hover:scale-[1.01] sm:col-span-1")}
            >
              Ver look
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}