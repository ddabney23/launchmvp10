'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Listing, CartItem } from "@/lib/types";
import { getListing } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface CartContextType {
  items: CartItem[];
  addItem: (listingId: string, quantity?: number) => Promise<void>;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        setItems(parsed);
      } catch (error) {
        console.error("Failed to load cart from localStorage:", error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const addItem = async (listingId: string, quantity: number = 1) => {
    setIsLoading(true);
    try {
      // Check if item already exists in cart
      const existingItem = items.find((item) => item.listing_id === listingId);

      if (existingItem) {
        // Update quantity
        setItems((prev) =>
          prev.map((item) =>
            item.listing_id === listingId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        );
        toast({ title: "Cart updated" });
      } else {
        // Fetch listing details and add new item
        const listing = await getListing(listingId);
        if (!listing.active || listing.quantity === 0) {
          toast({
            title: "Not available",
            description: "This listing is no longer available",
            variant: "destructive",
          });
          return;
        }

        const newItem: CartItem = {
          listing_id: listingId,
          quantity,
          listing,
        };

        setItems((prev) => [...prev, newItem]);
        toast({ title: "Added to cart" });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add item to cart'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = (listingId: string) => {
    setItems((prev) => prev.filter((item) => item.listing_id !== listingId));
    toast({ title: "Removed from cart" });
  };

  const updateQuantity = (listingId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(listingId);
      return;
    }

    // Check listing availability
    const item = items.find((item) => item.listing_id === listingId);
    if (item?.listing) {
      const maxQuantity = Math.min(item.listing.quantity, 10);
      const finalQuantity = Math.min(quantity, maxQuantity);

      if (finalQuantity < quantity) {
        toast({
          title: "Quantity limited",
          description: `Maximum ${maxQuantity} items available`,
          variant: "destructive",
        });
      }

      setItems((prev) =>
        prev.map((item) =>
          item.listing_id === listingId ? { ...item, quantity: finalQuantity } : item
        )
      );
    }
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem("cart");
  };

  const getTotal = (): number => {
    return items.reduce((total, item) => {
      if (item.listing) {
        return total + Number(item.listing.price) * item.quantity;
      }
      return total;
    }, 0);
  };

  const getItemCount = (): number => {
    return items.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

