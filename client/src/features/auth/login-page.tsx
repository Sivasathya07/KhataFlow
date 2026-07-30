import { useState } from "react";
import { useAuth } from "./auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lock, Mail } from "lucide-react";

export function LoginPage({
  onNavigateToRegister,
  onForgotPassword,
  onVerifyEmail,
}: {
  onNavigateToRegister: () => void;
  onForgotPassword: () => void;
  onVerifyEmail: () => void;
}) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Invalid credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />
      <div className="relative z-10 mx-auto grid w-full max-w-5xl gap-8 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="auth-hero animate-rise">
          <p className="font-display text-5xl leading-none tracking-tight text-[var(--ink)] sm:text-6xl">KhataFlow</p>
          <h1 className="mt-6 max-w-md font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
            The shop ledger that keeps pace with your counter.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-[var(--muted)]">
            Inventory, credit, GST bills, voice sales, and daily close — one calm workspace for Indian retail.
          </p>
        </section>
        <Card className="auth-card animate-rise-delay">
          <h2 className="font-display text-2xl text-[var(--ink)]">Sign in</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Continue managing your shop operations</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                <Input type="email" required className="pl-9" placeholder="you@shop.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Password</label>
                <button type="button" onClick={onForgotPassword} className="text-xs font-semibold text-[var(--accent-strong)]">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                <Input type="password" required className="pl-9" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="mt-2 h-11 w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            New shop?{" "}
            <button onClick={onNavigateToRegister} className="font-semibold text-[var(--accent-strong)]">
              Register your business
            </button>
          </p>
          <p className="mt-3 text-center text-xs text-[var(--muted)]">
            Have a verify token?{" "}
            <button type="button" onClick={onVerifyEmail} className="font-semibold text-[var(--accent-strong)]">
              Verify email
            </button>
          </p>
        </Card>
      </div>
    </main>
  );
}
