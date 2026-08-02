import { useState } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";

export function ForgotPasswordPage({
  onBack,
  onHaveToken,
}: {
  onBack: () => void;
  onHaveToken: (token?: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    setDevToken(null);
    try {
      const res = await api.post<{ data: { message: string; devToken?: string } }>("/auth/forgot-password", { email });
      setMessage(res.data.data.message);
      if (res.data.data.devToken) {
        setDevToken(res.data.data.devToken);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Could not start password reset."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />
      <Card className="auth-card">
        <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          <ArrowLeft size={16} /> Back to sign in
        </button>
        <h1 className="font-display text-3xl text-[var(--ink)]">Reset password</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">We will create a reset token for your account email.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && <p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}
          {devToken && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold">Development inbox</p>
              <p className="mt-1 break-all font-mono text-xs">{devToken}</p>
              <Button type="button" className="mt-3" onClick={() => onHaveToken(devToken)}>
                Continue with this token
              </Button>
            </div>
          )}
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <Input className="pl-9" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@shop.com" />
          </div>
          <Button type="submit" disabled={submitting} className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
