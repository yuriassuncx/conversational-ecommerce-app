import type { Product } from "../../types";
import { StyleExplanation } from "./StyleExplanation";

function buildStory(product: Product, relatedProducts: Product[]): string {
  const firstTag = product.tags[0]?.toLowerCase();
  const relation = relatedProducts[0]?.name;
  const mood = firstTag ? `o toque ${firstTag}` : "a leveza da silhueta";
  const extension = relation
    ? ` Quando combinado com ${relation}, o resultado fica equilibrado e pronto para transitar entre cenário urbano e destino de viagem.`
    : " A proposta é manter a peça principal respirando, com complementos que entram sem competir.";

  return `${product.name} funciona bem por causa de ${mood}, da construção visual limpa e da leitura elegante do look.${extension}`;
}

function withStyleSignals(base: string, styleSignals: string[]): string {
  if (styleSignals.length === 0) {
    return base;
  }

  return `${base} Estou priorizando sinais como ${styleSignals.slice(0, 3).join(", " )}, para manter continuidade com o que você vem pedindo.`;
}

export function OutfitStory({
  product,
  relatedProducts,
  styleSignals = [],
}: {
  product: Product;
  relatedProducts: Product[];
  styleSignals?: string[];
}) {
  return (
    <StyleExplanation
      title="Por que esse look funciona"
      body={withStyleSignals(buildStory(product, relatedProducts), styleSignals)}
    />
  );
}