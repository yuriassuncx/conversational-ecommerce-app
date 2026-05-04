export function FollowUpSuggestions({
  title = "Continue com o stylist",
  suggestions,
  onSelect,
}: {
  title?: string;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="rounded-full border border-black/[0.08] bg-white px-3 py-2 text-left text-xs font-medium text-black/65 transition-colors hover:border-black/20 hover:bg-[#f8f2ea] hover:text-black sm:max-w-[18rem]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}