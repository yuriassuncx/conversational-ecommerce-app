export function HeroLook({
  title,
  description,
  eyebrow,
  onPrimaryAction,
  primaryLabel,
}: {
  title: string;
  description: string;
  eyebrow: string;
  onPrimaryAction: () => void;
  primaryLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#f6efe6_0%,#fff9f2_32%,#ffffff_100%)] px-5 py-6 sm:px-6 sm:py-7">
      <div className="max-w-[38rem] space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/35">
          {eyebrow}
        </p>
        <h2 className="text-[1.75rem] font-medium leading-[1.02] tracking-[-0.03em] text-black sm:text-[2.15rem]">
          {title}
        </h2>
        <p className="text-sm leading-6 text-black/62 sm:text-[15px]">
          {description}
        </p>
        <button
          type="button"
          onClick={onPrimaryAction}
          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition-[transform,box-shadow] hover:scale-[1.01] hover:shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
        >
          {primaryLabel}
        </button>
      </div>
    </section>
  );
}