export function StyleExplanation({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-[1.75rem] bg-white p-5 shadow-[0_12px_28px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
          {title}
        </p>
        <p className="text-sm leading-6 text-black/65">{body}</p>
      </div>
    </section>
  );
}