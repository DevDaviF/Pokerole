"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { getStoredToken } from "@/lib/auth/session";

export function useApiQuery<T>(key: string[], path: string) {
  return useQuery({
    queryKey: key,
    queryFn: () => apiClient<T>(path, { token: getStoredToken() ?? undefined }),
  });
}
