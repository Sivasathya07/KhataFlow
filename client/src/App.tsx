import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, Bell, ClipboardCheck, Download, LayoutDashboard,
  LogOut, Menu, MessageCircle, Package, ReceiptText, Settings,
  ShoppingCart, Truck, Users, X, User, Building2, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { ForgotPasswordPage } from "@/features/auth/forgot-password-page";
import { ResetPasswordPage } from "@/features/auth/reset-password-page";
import { VerifyEmailPage } from "@/features/auth/verify-email-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { InventoryPage } from "@/features/inventory/inventory-page";
import { InventoryManagementPage } from "@/features/inventory/inventory-management-page";
import { CustomersPage } from "@/features/customers/customers-page";
import { TransactionsPage } from "@/features/transactions/transactions-page";
import { ReportsPage } from "@/features/reports/reports-page";
import { AnalyticsPage } from "@/features/analytics/analytics-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { AgentChatPage } from "@/features/agent/agent-chat-page";
import { PosPage } from "@/features/pos/pos-page";
import { SuppliersPage } from "@/features/suppliers/suppliers-page";
import { DailyClosePage } from "@/features/daily-close/daily-close-page";
import { NotificationsPanel } from "@/features/notifications/notifications-panel";
import { api } from "@/lib/api";

type Route =
  | "dashboard" | "pos" | "inventory" | "products" | "customers"
  | "suppliers" | "transactions" | "reports" | "analytics"
  | "daily-close" | "settings" | "assistant";

type AuthView = "login" | "register" | "forgot" | "reset" | "verify";

const routes: { id: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { id: "pos",         label: "Quick Sale",  icon: ShoppingCart },
  { id: "inventory",   label: "Inventory",   icon: Package },
  { id: "products",    label: "Products",    icon: Package },
  { id: "customers",   label: "Customers",   icon: Users },
  { id: "suppliers",   label: "Suppliers",   icon: Truck },
  { id: "transactions",label: "Transactions",icon: ReceiptText },
  { id: "reports",     label: "Reports",     icon: Download },
  { id: "analytics",   label: "Analytics",   icon: BarChart3 },
  { id: "daily-close", label: "Daily Close", icon: ClipboardCheck },
  { id: "assistant",   label: "AI Assistant",icon: MessageCircle },
  { id: "settings",    label: "Settings",    icon: Settings },
];

function parseHashRoute(): Route {
  const raw = location.hash.replace(/^#/, "").split("?")[0];
  return (routes.some((r) => r.id === raw) ? raw : "dashboard") as Route;
}

/* ── Profile Dropdown ─────────────────────────────────────── */
function ProfileDropdown({
  displayName, email, businessName, initials, onSettings, onLogout, align = "bottom",
}: {
  displayName: string; email: string; businessName: string; initials: string;
  onSettings: () => void; onLogout: () => void; align?: "bottom" | "top";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition
          ${align === "bottom"
            ? "bg-[var(--accent)] text-white hover:opacity-90 ring-2 ring-[var(--accent)]/30"
            : "bg-[var(--ink)] text-white hover:opacity-90 ring-2 ring-white/10"
          }`}
      >
        {initials}
      </button>

      {open && (
        <div
          className={`absolute z-50 w-64 rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl
            ${align === "bottom"
              ? "left-0 top-full mt-2"
              : "bottom-full left-0 mb-2"
            }`}
        >
          {/* Profile header */}
          <div className="flex items-center gap-3 border-b border-[var(--line)] p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-base font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--ink)]">{displayName}</p>
              <p className="truncate text-xs text-[var(--muted)]">{email}</p>
              {businessName && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-[var(--accent-strong)]">
                  <Building2 size={10} /> {businessName}
                </p>
              )}
            </div>
          </div>

          {/* Menu items */}
          <div className="p-2">
            <button
              type="button"
              onClick={() => { setOpen(false); onSettings(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--panel-hover)] transition"
            >
              <User size={16} className="text-[var(--muted)]" />
              <span>Profile & Settings</span>
              <ChevronRight size={14} className="ml-auto text-[var(--muted)]" />
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onSettings(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--panel-hover)] transition"
            >
              <Building2 size={16} className="text-[var(--muted)]" />
              <span>Business Settings</span>
              <ChevronRight size={14} className="ml-auto text-[var(--muted)]" />
            </button>
          </div>

          {/* Sign out */}
          <div className="border-t border-[var(--line)] p-2">
            <button
              type="button"
              onClick={() => { setOpen(false); onLogout(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-500 hover:bg-rose-50 transition"
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main App ─────────────────────────────────────────────── */
function App() {
  const { user, loading, logout } = useAuth();
  const [authPage, setAuthPage] = useState<AuthView>("login");
  const [resetToken, setResetToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [route, setRoute] = useState<Route>(() => parseHashRoute());
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [devBanner, setDevBanner] = useState<string | null>(
    () => localStorage.getItem("khataflow_dev_verify_token"),
  );

  useEffect(() => {
    const update = () => setRoute(parseHashRoute());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  useEffect(() => {
    const openNotif = () => setNotifOpen(true);
    window.addEventListener("khataflow:open-notifications", openNotif);
    return () => window.removeEventListener("khataflow:open-notifications", openNotif);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const res = await api.get<{ unreadCount: number }>("/notifications", { params: { limit: 1 } });
        if (active) setUnread(res.data.unreadCount ?? 0);
      } catch { /* optional */ }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user, notifOpen]);

  const navigate = (id: Route) => { location.hash = id; setOpen(false); };
  const initials = useMemo(() => (user?.displayName || "KF").slice(0, 2).toUpperCase(), [user]);
  const handleLogout = () => void logout();
  const goSettings = () => navigate("settings");

  /* ── Auth screens ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--paper)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <p className="font-display text-lg text-[var(--ink)]">Opening KhataFlow…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authPage === "register")
      return <RegisterPage onNavigateToLogin={() => setAuthPage("login")}
        onRegistered={(dt) => { if (dt) { localStorage.setItem("khataflow_dev_verify_token", dt); setDevBanner(dt); setVerifyToken(dt); } }} />;
    if (authPage === "forgot")
      return <ForgotPasswordPage onBack={() => setAuthPage("login")}
        onHaveToken={(t) => { if (t) setResetToken(t); setAuthPage("reset"); }} />;
    if (authPage === "reset")
      return <ResetPasswordPage initialToken={resetToken} onBack={() => setAuthPage("forgot")} onDone={() => setAuthPage("login")} />;
    if (authPage === "verify")
      return <VerifyEmailPage initialToken={verifyToken} onBack={() => setAuthPage("login")} onDone={() => setAuthPage("login")} />;
    return <LoginPage onNavigateToRegister={() => setAuthPage("register")}
      onForgotPassword={() => setAuthPage("forgot")} onVerifyEmail={() => setAuthPage("verify")} />;
  }

  /* ── Route content ── */
  const content = {
    dashboard:   <DashboardPage />,
    pos:         <PosPage />,
    inventory:   <InventoryManagementPage />,
    products:    <InventoryPage />,
    customers:   <CustomersPage />,
    suppliers:   <SuppliersPage />,
    transactions:<TransactionsPage />,
    reports:     <ReportsPage />,
    analytics:   <AnalyticsPage />,
    "daily-close":<DailyClosePage />,
    settings:    <SettingsPage />,
    assistant:   <AgentChatPage />,
  }[route] ?? <DashboardPage />;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] lg:flex">

      {/* Mobile menu toggle */}
      <button
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-20 rounded-md border border-[var(--line)] bg-[var(--panel)]/90 p-2 shadow lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* ── Sidebar ── */}
      <aside className={`${open ? "translate-x-0" : "-translate-x-full"}
        fixed inset-y-0 left-0 z-30 flex w-64 flex-col justify-between
        border-r border-[var(--line)] bg-[var(--ink)] p-4 text-[var(--paper)]
        transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}
      >
        <div>
          {/* Logo */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="font-display text-2xl tracking-tight text-white">KhataFlow</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-teal-200/80">Shop operations</p>
            </div>
            <button aria-label="Close navigation" className="lg:hidden" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>

          {/* Nav links */}
          <nav className="space-y-0.5">
            {routes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  route === id
                    ? "bg-[var(--accent)] text-white shadow-lg shadow-teal-900/30"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Sidebar bottom profile ── */}
        <div className="border-t border-white/10 pt-4">
          <ProfileDropdown
            displayName={user.displayName}
            email={user.email}
            businessName={user.businessName || ""}
            initials={initials}
            onSettings={goSettings}
            onLogout={handleLogout}
            align="top"
          />
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <button
          aria-label="Close menu overlay"
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <div className="min-w-0 flex-1">

        {/* Top header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="pl-12 lg:pl-0">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Workspace</p>
            <p className="font-display text-xl text-[var(--ink)]">{user.businessName || "Your shop"}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications bell */}
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setNotifOpen(true)}
              className="relative rounded-full border border-[var(--line)] bg-[var(--panel)] p-2.5 hover:border-[var(--accent)] transition"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>

            {/* Top-right profile avatar with dropdown */}
            <ProfileDropdown
              displayName={user.displayName}
              email={user.email}
              businessName={user.businessName || ""}
              initials={initials}
              onSettings={goSettings}
              onLogout={handleLogout}
              align="bottom"
            />
          </div>
        </header>

        {/* Dev banner */}
        {devBanner && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6">
            <strong>Dev verify token:</strong>{" "}
            <span className="break-all font-mono text-xs">{devBanner}</span>
            <button
              type="button"
              className="ml-3 font-semibold text-teal-800 underline"
              onClick={() => { localStorage.removeItem("khataflow_dev_verify_token"); setDevBanner(null); }}
            >
              Dismiss
            </button>
          </div>
        )}

        {content}
      </div>

      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onChanged={(count) => setUnread(count)}
      />
    </div>
  );
}

export default App;
