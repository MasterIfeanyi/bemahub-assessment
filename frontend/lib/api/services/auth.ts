import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/authStore";
import type { LoginResponse, Earnings } from "@/lib/types/api";

async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/auth/login", { email, password });
  return response.data;
}

export function useLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginRequest(email, password),
    onSuccess: (data) => signIn(data.token, data.user),
  });
}

async function fetchEarnings(): Promise<Earnings> {
  const response = await api.get<Earnings>("/me/earnings");
  return response.data;
}

export function useEarnings(enabled: boolean) {
  return useQuery({
    queryKey: ["earnings"],
    queryFn: fetchEarnings,
    enabled,
    retry: false, // don't retry a 401/403, that just delays showing the real state
  });
}