"use client";

import { useAuthStore } from "@/lib/auth/authStore";
import { useEarnings } from "@/lib/api/services/auth";
import { StatusMessage } from "@/components/StatusMessage";
import { formatMoney } from "@/lib/format";

export default function EarningsPage() {
  const token = useAuthStore((s) => s.token);
  const { data, isLoading, isError, error } = useEarnings(!!token);

  if (!token) {
    return <StatusMessage state="error" message="You need to sign in to view earnings." />;
  }

  if (isLoading) {
    return <StatusMessage state="loading" />;
  }

  if (isError) {
    const err = error as any;
    if (!err?.response) {
      return <StatusMessage state="error" message="Network error: could not reach the server." />;
    }
    if (err.response.status === 403) {
      return (
        <StatusMessage state="error" message="You are not permitted to view earnings (instructor accounts only)." />
      );
    }
    return <StatusMessage state="error" message="Could not load earnings." />;
  }

  if (!data) {
    return <StatusMessage state="empty" message="No earnings data yet." />;
  }

  return (
    <div className="space-y-2 p-6">
      <h1 className="text-xl font-semibold">Earnings</h1>
      <p>Available: {formatMoney(data.availableMinor, data.currency)}</p>
      <p>Pending: {formatMoney(data.pendingMinor, data.currency)}</p>
    </div>
  );
}