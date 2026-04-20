"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Invalid credentials");
    else router.push("/dashboard");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex mb-8"><Logo /></Link>
        <div className="card-pad">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-fg-muted mt-1">Access your EquityIA cockpit.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-sm text-down">{error}</div>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="text-sm text-fg-muted mt-6 text-center">
            No account? <Link href="/register" className="text-brand-400 hover:text-brand-300">Create one</Link>
          </p>
          <p className="text-xs text-fg-subtle mt-4 text-center">
            Demo: <span className="text-fg-muted">demo@equityia.app</span> / <span className="text-fg-muted">demo1234</span>
          </p>
        </div>
      </div>
    </div>
  );
}
