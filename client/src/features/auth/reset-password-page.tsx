import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, KeyRound } from "lucide-react";

export function ResetPasswordPage({
  initialToken = "",
  onDone,
  onBack,
}: {
  initialToken?: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      onDone();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Could not reset password.");
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
        <h1 className="font-display text-3xl text-[var(--ink)]">Choose a new password</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Paste your reset token and set a strong password.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Reset token</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 text-[var(--muted)]" size={16} />
            <textarea
              required
              className="min-h-24 w-full rounded-md border border-[var(--line)] bg-white/80 p-3 pl-9 text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">New password</label>
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" disabled={submitting} className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
            {submitting ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
