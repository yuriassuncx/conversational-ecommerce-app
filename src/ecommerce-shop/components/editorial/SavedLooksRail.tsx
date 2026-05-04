import type { SavedLook } from "../../types";
import { CommerceImage } from "../commerce/CommerceImage";

export function SavedLooksRail({
  looks,
  onOpenLook,
}: {
  looks: SavedLook[];
  onOpenLook: (look: SavedLook) => void;
}) {
  if (looks.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
          Looks salvos
        </p>
        <p className="text-sm leading-6 text-black/60">
          Retome combinações que já refletem o seu gosto sem recomeçar a conversa.
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)]" role="list" aria-label="Looks salvos">
        {looks.map((look) => (
          <article
            key={look.id}
            role="listitem"
            tabIndex={0}
            onClick={() => onOpenLook(look)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenLook(look);
              }
            }}
            className="w-[15rem] shrink-0 cursor-pointer overflow-hidden rounded-[1.5rem] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.06] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(0,0,0,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b84f3b]/35"
          >
            <CommerceImage
              src={look.anchor.image}
              alt={look.title}
              className="aspect-[4/5] w-full"
              fallbackLabel="Look salvo"
            />
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35">
                  {look.anchor.brand}
                </p>
                <p className="line-clamp-2 text-sm font-medium leading-5 text-black">
                  {look.title}
                </p>
                <p className="text-xs leading-5 text-black/55">{look.note}</p>
              </div>
              <span className="inline-flex rounded-full bg-[#f6eee5] px-3 py-1.5 text-xs font-semibold text-black/70">
                Abrir look
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}