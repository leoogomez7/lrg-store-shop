import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { toast } from "sonner";
import type { BrandSlug } from "@/config/brands";
import type { Product } from "@/data/products";
import {
  loadGuestCart,
  loadUserCart,
  saveGuestCart,
  saveUserCart,
  type CartItem as PersistedCartItem,
} from "@/server/persistence";

export type CartItem = PersistedCartItem & {
  id: string;
  slug: string;
  brand: BrandSlug;
};

type CartState = { items: CartItem[]; hydrated: boolean; remoteHydrated: boolean };

type CartAction =
  | { type: "hydrate"; items: CartItem[]; remote?: boolean }
  | { type: "add"; item: CartItem }
  | { type: "remove"; id: string }
  | { type: "quantity"; id: string; quantity: number }
  | { type: "clear" }
  | { type: "clearBrand"; brand: BrandSlug };

function getGuestSessionId() {
  const match = document.cookie.match(/(?:^|; )lrg_guest_session=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  const sessionId = crypto.randomUUID();
  document.cookie = `lrg_guest_session=${encodeURIComponent(sessionId)}; Max-Age=2592000; Path=/; SameSite=Lax`;
  return sessionId;
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return {
        items: action.items,
        hydrated: true,
        remoteHydrated: action.remote ?? state.remoteHydrated,
      };
    case "add": {
      const existing = state.items.find((item) => item.id === action.item.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === action.item.id
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + action.item.quantity, item.stock),
                }
              : item,
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case "remove":
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case "quantity":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id
            ? { ...item, quantity: Math.max(1, Math.min(action.quantity, item.stock)) }
            : item,
        ),
      };
    case "clear":
      return { ...state, items: [] };
    case "clearBrand":
      return { ...state, items: state.items.filter((item) => item.brand !== action.brand) };
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  subtotal: number;
  addProduct: (product: Product, quantity?: number) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  itemsByBrand: (brand: BrandSlug) => CartItem[];
  brandSubtotal: (brand: BrandSlug) => number;
  clearBrand: (brand: BrandSlug) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  user,
  isAuthenticated = false,
  isLoading = false,
}: {
  children: React.ReactNode;
  user?: { id: string; email?: string } | null;
  isAuthenticated?: boolean;
  isLoading?: boolean;
}) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    hydrated: false,
    remoteHydrated: false,
  });

  useEffect(() => {
    if (isLoading) return;
    const sessionId = !isAuthenticated ? getGuestSessionId() : null;
    const request =
      isAuthenticated && user?.id
        ? loadUserCart({
            data: user.email ? { id: user.id, email: user.email } : { id: user.id },
          })
        : loadGuestCart({ data: { sessionId: sessionId ?? "" } });
    request
      .then((items) => dispatch({ type: "hydrate", items: items ?? [], remote: true }))
      .catch(() => {
        dispatch({ type: "hydrate", items: [], remote: true });
      });
  }, [isAuthenticated, isLoading, user?.email, user?.id]);

  useEffect(() => {
    if (!state.hydrated || !state.remoteHydrated) return;
    if (isAuthenticated && user?.id) {
      void saveUserCart({
        data: user.email
          ? { id: user.id, email: user.email, items: state.items }
          : { id: user.id, items: state.items },
      });
    } else if (!isAuthenticated) {
      void saveGuestCart({ data: { sessionId: getGuestSessionId(), items: state.items } });
    }
  }, [isAuthenticated, state.hydrated, state.items, state.remoteHydrated, user?.email, user?.id]);

  const addProduct = useCallback((product: Product, quantity = 1) => {
    if (product.stock <= 0) {
      toast.error("Sin stock disponible", {
        description: `${product.name} no está disponible por el momento.`,
      });
      return;
    }
    const existing = state.items.find((i) => i.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.error("No hay más stock disponible", {
          description: `${product.name} alcanzó su límite de stock.`,
        });
        return;
      }
      const canAdd = Math.min(quantity, product.stock - existing.quantity);
      if (canAdd <= 0) {
        toast.error("No hay más stock disponible", {
          description: `${product.name} alcanzó su límite de stock.`,
        });
        return;
      }
      dispatch({
        type: "add",
        item: {
          id: product.id,
          slug: product.slug,
          brand: product.brand,
          name: product.name,
          price: product.price,
          quantity: canAdd,
          stock: product.stock,
        },
      });
      if (canAdd < quantity) {
        toast("Se agregó parte del pedido: se alcanzó el límite de stock", {
          description: product.name,
        });
      } else {
        toast.success("Agregado al carrito", { description: product.name });
      }
      return;
    }

    const toAdd = Math.min(quantity, product.stock);
    dispatch({
      type: "add",
      item: {
        id: product.id,
        slug: product.slug,
        brand: product.brand,
        name: product.name,
        price: product.price,
        quantity: toAdd,
        stock: product.stock,
      },
    });
    if (toAdd < quantity) {
      toast("Se agregó parte del pedido: se alcanzó el límite de stock", {
        description: product.name,
      });
    } else {
      toast.success("Agregado al carrito", { description: product.name });
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "remove", id });
    toast("Producto eliminado del carrito");
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: "quantity", id, quantity });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const clearBrand = useCallback((brand: BrandSlug) => {
    dispatch({ type: "clearBrand", brand });
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = state.items.reduce((total, item) => total + item.price * item.quantity, 0);
    return {
      items: state.items,
      hydrated: state.hydrated,
      count,
      subtotal,
      addProduct,
      removeItem,
      setQuantity,
      clear,
      clearBrand,
      itemsByBrand: (brand) => state.items.filter((item) => item.brand === brand),
      brandSubtotal: (brand) =>
        state.items
          .filter((item) => item.brand === brand)
          .reduce((total, item) => total + item.price * item.quantity, 0),
    };
  }, [state.items, state.hydrated, addProduct, removeItem, setQuantity, clear, clearBrand]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
