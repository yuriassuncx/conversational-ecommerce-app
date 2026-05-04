export type ProductSize = "PP" | "P" | "M" | "G" | "GG" | "U" | string;

export type ProductCategory =
  | "vestido"
  | "blusa"
  | "saia"
  | "calça"
  | "macacão"
  | "acessório"
  | "conjunto"
  | "outro";

export interface Product {
  id: string;
  productID: string;
  sku: string;
  gtin: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  gallery?: string[];
  category: ProductCategory;
  tags: string[];
  sizes: ProductSize[];
  color: string;
  installments?: { count: number; value: number };
  inStock: boolean;
  brand: string;
  url?: string;
  outfitPairs?: string[];
  sizeSkuMap?: Record<string, string>;
}
