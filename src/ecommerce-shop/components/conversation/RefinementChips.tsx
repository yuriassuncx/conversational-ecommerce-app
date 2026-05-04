const DEFAULT_CHIPS = [
  "mais elegante",
  "menos estampado",
  "mais casual",
  "ate R$300",
  "para noite",
  "resort chic",
  "tropical minimal",
] as const;

export function RefinementChips({
  onSelect,
  chips = DEFAULT_CHIPS,
  label = "Refinar o styling",
}: {
  onSelect: (chip: string) => void;
  chips?: readonly string[];
  label?: string;
}) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
        {label}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)]">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSelect(chip)}
            className="shrink-0 rounded-full border border-black/[0.06] bg-white px-3 py-1.5 text-xs font-medium text-black/68 transition-colors hover:border-black/[0.12] hover:bg-[#f4e8db] hover:text-black"
          >
            {chip}
          </button>
        ))}
      </div>
    </section>
  );
}