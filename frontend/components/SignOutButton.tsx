"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authStore";

export function SignOutButton() {
  const token = useAuthStore((s) => s.token);
  const signOut = useAuthStore((s) => s.signOut);
  const router = useRouter();

  if (!token) return null;

  return (
    <button
      onClick={() => {
        signOut();
        router.push("/login");
      }}
      className="text-sm text-slate-500 underline"
    >
      Sign out
    </button>
  );
}