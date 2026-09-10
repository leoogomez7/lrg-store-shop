import { createContext, useContext } from "react";
import type { BrandSlug } from "@/config/brands";
import type { CartItem } from "@/server/persistence";

export type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  subtotal: number;
  addProduct: (product: import("@/data/products").Product, quantity?: number) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  itemsByBrand: (brand: BrandSlug) => CartItem[];
  brandSubtotal: (brand: BrandSlug) => number;
  clearBrand: (brand: BrandSlug) => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
