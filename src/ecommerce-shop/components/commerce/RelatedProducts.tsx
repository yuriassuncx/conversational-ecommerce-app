import { brl } from "../../format";
import type { Product } from "../../types";
import { CommerceImage } from "./CommerceImage";

export function RelatedProducts({
  products,
  onOpenDetail,
}: {
  products: Product[];
  onOpenDetail: (product: Product) => void;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
          Complete o look
        </p>
        <p className="text-sm leading-6 text-black/60">
          Escolhas que prolongam a mesma linguagem visual com leveza, contraste e proporção equilibrada.
        </p>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)]"
        role="list"
        aria-label="Sugestões relacionadas"
      >
        {products.map((product) => (
          <article
            key={product.id}
            role="listitem"
            tabIndex={0}
            onClick={() => onOpenDetail(product)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenDetail(product);
              }
            }}
            className="group w-[15rem] shrink-0 cursor-pointer overflow-hidden rounded-[1.5rem] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.06] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(0,0,0,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b84f3b]/35"
          >
            <CommerceImage
              src={product.image}
              alt={`${product.name} — ${product.brand}`}
              className="aspect-[4/5] w-full"
              fallbackLabel={product.category}
            />
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35">
                  {product.brand}
                </p>
                <p className="line-clamp-2 text-sm font-medium leading-5 text-black">
                  {product.name}
                </p>
                <p className="text-sm text-black/55">{brl(product.price)}</p>
              </div>
              <span className="inline-flex rounded-full bg-[#f6eee5] px-3 py-1.5 text-xs font-semibold text-black/70 transition-colors group-hover:bg-[#ecdcc8]">
                Ver peça
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}