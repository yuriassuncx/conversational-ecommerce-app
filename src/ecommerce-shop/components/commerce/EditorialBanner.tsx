import type { Product } from "../../types";

const OCCASION_PROMPTS = [
  "Quero um look para jantar",
  "Me mostra uma versão mais colorida",
  "Penso em usar isso em uma viagem",
] as const;

export function EditorialBanner({
  product,
  onPromptSelect,
}: {
  product: Product;
  onPromptSelect: (prompt: string) => void;
}) {
  const story =
    product.shortDescription && product.shortDescription !== "."
      ? product.shortDescription
      : product.description;

  return (
    <section className="rounded-[2rem] bg-black/[0.03] px-5 py-5 sm:px-6 sm:py-6">
      <div className="space-y-3">
        <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45">
          FARM Rio stylist
        </span>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/35">
            {product.brand} . {product.category}
          </p>
          <p className="max-w-full text-sm leading-6 text-black/62 sm:max-w-[34rem] sm:text-[15px]">
            {story}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 pr-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)]">
          {OCCASION_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptSelect(`${prompt} com ${product.name}`)}
              className="shrink-0 rounded-full border border-black/[0.06] bg-white/88 px-3 py-1.5 text-xs font-medium text-black/62 transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}