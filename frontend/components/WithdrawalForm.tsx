"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useWithdraw } from "@/lib/api/services/withdrawals";
import type { Earnings } from "@/lib/types/api";

function buildSchema(minMinor: number, maxMinor: number) {
  return z.object({
    amount: z.coerce
      .number({ invalid_type_error: "Enter an amount." })
      .positive("Amount must be greater than zero.")
      .refine((v) => Math.round(v * 100) >= minMinor, {
        message: `Amount must be at least ${(minMinor / 100).toFixed(2)}.`,
      })
      .refine((v) => Math.round(v * 100) <= maxMinor, {
        message: `Amount cannot exceed your available balance of ${(maxMinor / 100).toFixed(2)}.`,
      }),
  });
}

type FormValues = { amount: number };

export function WithdrawalForm({ earnings }: { earnings: Earnings }) {
  const schema = buildSchema(earnings.minimumWithdrawalMinor, earnings.availableMinor);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { mutateAsync } = useWithdraw();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generated once per attempt. A retry of the SAME attempt reuses this
  // value so the server recognises a duplicate and returns the original
  // withdrawal instead of creating a second one. Only a fresh attempt
  // (after success) gets a new reference.
  const payoutReferenceRef = useRef<string>(crypto.randomUUID());

  const onSubmit = async (values: FormValues) => {
    setSuccessMessage(null);
    const amountMinor = Math.round(values.amount * 100);
    try {
      const result = await mutateAsync({
        amountMinor,
        payoutReference: payoutReferenceRef.current,
      });
      setSuccessMessage(`Withdrawal requested: ${result.status}.`);
      payoutReferenceRef.current = crypto.randomUUID();
      reset();
    } catch (err: any) {
      if (!err?.response) {
        setError("amount", { message: "Network error, could not reach the server." });
        return;
      }
      const code = err.response.data?.code;
      if (code === "below_minimum" || code === "insufficient_balance") {
        setError("amount", { message: err.response.data.message });
        return;
      }
      if (code === "withdrawal_in_progress") {
        setError("amount", { message: "A withdrawal is already pending." });
        return;
      }
      setError("amount", { message: "Could not submit the withdrawal. Please try again." });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-6 max-w-sm">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium">
          Withdrawal amount ({earnings.currency})
        </label>
        <input
          id="amount"
          type="number"
          step="0.01"
          {...register("amount")}
          disabled={isSubmitting}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
        {errors.amount && <p className="mt-1 text-sm text-red-700">{errors.amount.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isSubmitting ? "Submitting…" : "Withdraw"}
      </button>
      {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}
    </form>
  );
}