import clsx from "clsx";
import { Heart } from "lucide-react";
import { CommerceImage } from "./CommerceImage";

export function ProductHero({
  name,
  brand,
  images,
  galleryIdx,
  onSelectImage,
  discount,
  isWishlisted,
  onToggleWishlist,
}: {
  name: string;
  brand: string;
  images: string[];
  galleryIdx: number;
  onSelectImage: (index: number) => void;
  discount: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#f5ede4] shadow-[0_20px_45px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.06]">
        <CommerceImage
          src={images[galleryIdx]}
          alt={`${name} — ${brand}`}
          className="aspect-[4/5] max-h-[72svh] w-full sm:max-h-[78svh]"
          imageClassName="object-contain object-top"
          fallbackLabel={brand}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/12 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-5">
          {discount > 0 ? (
            <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-black backdrop-blur-sm">
              -{discount}%
            </span>
          ) : (
            <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40 backdrop-blur-sm">
              Escolha curada
            </span>
          )}
          <button
            type="button"
            aria-label={isWishlisted ? "Remover dos favoritos" : "Salvar nos favoritos"}
            aria-pressed={isWishlisted}
            onClick={onToggleWishlist}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/82 text-black backdrop-blur-sm transition-colors hover:bg-white"
          >
            <Heart
              className={clsx("h-4 w-4", isWishlisted ? "text-black" : "text-black/35")}
              fill={isWishlisted ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {images.length > 1 && (
        <div
          role="tablist"
          aria-label="Galeria do produto"
          className="flex gap-2 overflow-x-auto pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)]"
        >
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === galleryIdx}
              aria-label={`Imagem ${index + 1}`}
              onClick={() => onSelectImage(index)}
              className={clsx(
                "relative shrink-0 overflow-hidden rounded-[1.25rem] border transition-all",
                index === galleryIdx
                  ? "border-black shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
                  : "border-black/8 opacity-75 hover:opacity-100"
              )}
            >
              <CommerceImage
                src={image}
                alt={`${name} — miniatura ${index + 1}`}
                className="h-20 w-16"
                fallbackLabel={`Imagem ${index + 1}`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}