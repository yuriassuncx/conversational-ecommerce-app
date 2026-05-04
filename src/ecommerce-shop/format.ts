export function brl(value: number): string {
  if (!Number.isFinite(value)) {
    return "R$ 0,00";
  }

  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function installmentLabel(inst: { count: number; value: number }): string {
  if (!Number.isFinite(inst.count) || !Number.isFinite(inst.value)) {
    return brl(0);
  }

  if (inst.count <= 1) return brl(inst.value);
  return `${inst.count}x ${brl(inst.value)} s/juros`;
}