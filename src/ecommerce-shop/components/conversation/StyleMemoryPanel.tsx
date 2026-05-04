import { useEffect, useMemo, useState } from "react";

export function StyleMemoryPanel({
  refinements,
  lastIntent,
}: {
  refinements: string[];
  lastIntent?: string;
}) {
  if (refinements.length === 0 && !lastIntent) {
    return null;
  }

  const [expanded, setExpanded] = useState(false);
  const visibleRefinements = useMemo(
    () => (expanded ? refinements : refinements.slice(0, 4)),
    [expanded, refinements]
  );
  const hasOverflow = refinements.length > 4;

  useEffect(() => {
    setExpanded(false);
  }, [lastIntent, refinements]);

  return (
    <section className="rounded-[1.75rem] bg-white p-4 shadow-[0_12px_28px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/35">
            Memória de estilo
          </p>
          <p className="text-sm leading-6 text-black/60">
            {lastIntent
              ? `Estou mantendo o contexto do seu styling com foco em ${lastIntent}.`
              : "Estou guardando os sinais mais recentes para refinar a próxima resposta."}
          </p>
        </div>
        {refinements.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 overflow-hidden">
              {visibleRefinements.map((refinement) => (
              <span
                key={refinement}
                className="max-w-full truncate rounded-full bg-black/[0.04] px-3 py-1.5 text-[11px] font-medium text-black/60"
              >
                {refinement}
              </span>
              ))}
            </div>
            {hasOverflow ? (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="text-xs font-semibold text-black/55 transition-colors hover:text-black"
              >
                {expanded ? "Ver menos" : `Ver todos (${refinements.length})`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}