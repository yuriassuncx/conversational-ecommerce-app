import { Sparkles } from "lucide-react";
import type { Product } from "../../types";

export function OutfitSuggestion({
  product,
  onAskForOutfit,
}: {
  product: Product;
  onAskForOutfit: (product: Product) => void;
}) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-black">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
              Stylist FARM Rio
            </p>
            <p className="text-sm leading-6 text-black/68">
              Peça para eu montar um look com {product.name.toLowerCase()} e eu sugiro combinações coerentes com a peça, a ocasião e o clima.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAskForOutfit(product)}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.01]"
          >
            Montar look com IA
          </button>
        </div>
      </div>
    </section>
  );
}