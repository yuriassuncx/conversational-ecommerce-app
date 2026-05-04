import type { ReactNode } from "react";

export function MoodboardRail({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1 px-1">
        <h2 className="text-lg font-semibold text-black">{title}</h2>
        <p className="max-w-[36rem] text-sm leading-6 text-black/55">{description}</p>
      </div>
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)]" role="list" aria-label={title}>
        {children}
      </div>
    </section>
  );
}