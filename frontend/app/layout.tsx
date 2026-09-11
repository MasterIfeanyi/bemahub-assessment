import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SignOutButton } from "../components/SignOutButton";

export const metadata: Metadata = {
  title: "Bema Learn",
  description: "Assessment environment",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <header className="border-b bg-white">
            <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
              <h1 className="text-lg font-semibold">Bema Learn</h1>
              <SignOutButton />
            </div>
          </header>
          <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
