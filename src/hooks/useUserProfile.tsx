'use client'

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, updateProfile, searchProfiles } from "@/lib/api";
import type { Profile, ProfileUpdate } from "@/lib/types";

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => {
      if (!userId) throw new Error("User ID required");
      return getProfile(userId);
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: ProfileUpdate }) =>
      updateProfile(userId, updates),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["profile", variables.userId], data);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useSearchProfiles(query: string) {
  return useQuery({
    queryKey: ["profiles", "search", query],
    queryFn: () => searchProfiles(query),
    enabled: query.length > 2,
  });
}

