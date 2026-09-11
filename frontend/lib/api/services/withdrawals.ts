import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Withdrawal } from "@/lib/types/api";

interface WithdrawPayload {
  amountMinor: number;
  payoutReference: string;
}

async function postWithdrawal(payload: WithdrawPayload): Promise<Withdrawal> {
  const response = await api.post<Withdrawal>("/me/withdrawals", payload, {
    headers: { "Idempotency-Key": payload.payoutReference },
  });
  return response.data;
}

export function useWithdraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postWithdrawal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
    },
  });
}