import clsx from "clsx";

export function ProductRail({
  title,
  items,
  activeId,
  onSelect,
}: {
  title: string;
  items: Array<{ id: string; label: string; meta?: string }>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/35">
        {title}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)]">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={clsx(
              "shrink-0 rounded-full border px-4 py-2 text-left transition-colors",
              activeId === item.id
                ? "border-black bg-black text-white"
                : "border-black/[0.06] bg-white text-black/65 hover:border-black/[0.12] hover:bg-[#f5ede4] hover:text-black"
            )}
          >
            <span className="block text-xs font-medium">{item.label}</span>
            {item.meta ? (
              <span className={clsx("block text-[10px]", activeId === item.id ? "text-white/70" : "text-black/40")}>
                {item.meta}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}