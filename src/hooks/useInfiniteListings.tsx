'use client'

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getListings, searchListings, getVendorListings } from "@/lib/api";
import type { Listing } from "@/lib/types";

export function useInfiniteListings(category?: string) {
  return useInfiniteQuery({
    queryKey: ["listings", category || "all"],
    queryFn: ({ pageParam = 0 }) => getListings(pageParam, 20, category),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < 20) return undefined;
      return pages.length;
    },
    initialPageParam: 0,
  });
}

export function useSearchListings(query: string) {
  return useInfiniteQuery({
    queryKey: ["listings", "search", query],
    queryFn: ({ pageParam = 0 }) => searchListings(query, pageParam, 20),
    enabled: query.length > 0,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < 20) return undefined;
      return pages.length;
    },
    initialPageParam: 0,
  });
}

export function useVendorListings(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["listings", "vendor", vendorId],
    queryFn: () => {
      if (!vendorId) throw new Error("Vendor ID required");
      return getVendorListings(vendorId);
    },
    enabled: !!vendorId,
  });
}

