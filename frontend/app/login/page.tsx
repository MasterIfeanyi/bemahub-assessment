/*
* Lets someone log in
*/
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "@/lib/api/services/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const login = useLogin();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => router.push("/earnings") });
  }

  const errorMessage = (() => {
    if (!login.isError) return null;
    const err = login.error as any;
    if (!err?.response) return "Network error: could not reach the server.";
    return err.response.data?.message ?? "Invalid email or password.";
  })();

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <div>
        <label className="block text-sm">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
      </div>
      <div>
        <label className="block text-sm">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
      </div>
      <button
        type="submit"
        disabled={login.isPending}
        className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50"
      >
        {login.isPending ? "Signing in…" : "Sign in"}
      </button>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}