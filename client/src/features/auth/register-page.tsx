import { useState } from "react";
import { useAuth } from "./auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Building, Mail, User } from "lucide-react";

export function RegisterPage({
  onNavigateToLogin,
  onRegistered,
}: {
  onNavigateToLogin: () => void;
  onRegistered?: (devToken?: string) => void;
}) {
  const { register } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !displayName || !email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await register(businessName, displayName, email, password);
      onRegistered?.(result.devToken);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Registration failed. Try a different email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />
      <Card className="auth-card animate-rise relative z-10 mx-auto w-full max-w-md">
        <p className="font-display text-3xl text-[var(--ink)]">KhataFlow</p>
        <h1 className="mt-3 font-display text-2xl text-[var(--ink)]">Register your shop</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Create the owner account for your business</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <Input className="pl-9" required placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <Input className="pl-9" required placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <Input className="pl-9" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Input type="password" required minLength={8} placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" disabled={submitting} className="h-11 w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">
            {submitting ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Already registered?{" "}
          <button onClick={onNavigateToLogin} className="font-semibold text-[var(--accent-strong)]">
            Sign in
          </button>
        </p>
      </Card>
    </main>
  );
}
