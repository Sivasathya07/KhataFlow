import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BadgeCheck } from "lucide-react";

export function VerifyEmailPage({
  initialToken = "",
  onDone,
  onBack,
}: {
  initialToken?: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ data: { message: string } }>("/auth/verify-email", { token });
      setMessage(res.data.data.message);
      setTimeout(onDone, 800);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Could not verify email.");
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
          <ArrowLeft size={16} /> Back
        </button>
        <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
          <BadgeCheck size={22} />
        </div>
        <h1 className="font-display text-3xl text-[var(--ink)]">Verify your email</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Paste the verification token from your registration or development inbox.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && <p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}
          <textarea
            required
            className="min-h-28 w-full rounded-md border border-[var(--line)] bg-white/80 p-3 text-sm"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Verification token"
          />
          <Button type="submit" disabled={submitting} className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
            {submitting ? "Verifying…" : "Verify email"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
