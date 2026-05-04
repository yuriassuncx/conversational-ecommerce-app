import { Heart, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { CartFeedback } from "../../types";

export function MiniCart({
  cartCount,
  favoritesCount,
  cartFeedback,
  onOpenCart,
  onOpenWishlist,
}: {
  cartCount: number;
  favoritesCount: number;
  cartFeedback?: CartFeedback | null;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/84 p-1 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur-md">
      <button
        type="button"
        onClick={onOpenCart}
        className="flex items-center gap-3 rounded-full px-3 py-2 text-left transition-colors hover:bg-black/[0.03]"
        aria-label={`Abrir carrinho com ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35">
            Seu look
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={cartFeedback ? `${cartFeedback.productId}-${cartFeedback.addedAt}` : `count-${cartCount}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="block max-w-[11rem] truncate text-xs font-medium text-black"
            >
              {cartFeedback
                ? `${cartFeedback.productName} · Tam ${cartFeedback.size}`
                  : `${cartCount} ${cartCount === 1 ? "peça" : "peças"} no look`}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
      {favoritesCount > 0 ? (
        <button
          type="button"
          onClick={onOpenWishlist}
          className="flex h-10 min-w-[3rem] items-center justify-center gap-1 rounded-full bg-white px-3 text-black transition-colors hover:bg-black/[0.04]"
          aria-label={`Abrir favoritos com ${favoritesCount} ${favoritesCount === 1 ? "item" : "itens"}`}
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-semibold">{favoritesCount}</span>
        </button>
      ) : null}
    </div>
  );
}