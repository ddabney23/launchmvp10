'use client'

import { useInfiniteQuery } from "@tanstack/react-query";
import { getFeedPosts, getUserPosts } from "@/lib/api";
import type { Post } from "@/lib/types";

export function useFeed() {
  return useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam = 0 }) => getFeedPosts(pageParam, 20),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < 20) return undefined;
      return pages.length;
    },
    initialPageParam: 0,
  });
}

export function useUserPosts(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["posts", "user", userId],
    queryFn: ({ pageParam = 0 }) => {
      if (!userId) throw new Error("User ID required");
      return getUserPosts(userId, pageParam, 20);
    },
    enabled: !!userId,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < 20) return undefined;
      return pages.length;
    },
    initialPageParam: 0,
  });
}

