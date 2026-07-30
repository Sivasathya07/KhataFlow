import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  payload?: { whatsappLink?: string };
}

export function NotificationsPanel({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: (unread: number) => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    const res = await api.get<{ data: NotificationItem[]; unreadCount: number }>("/notifications");
    setItems(res.data.data);
    setUnread(res.data.unreadCount);
    onChanged(res.data.unreadCount);
  };

  useEffect(() => {
    if (!open) return;
    void load().catch(() => undefined);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close notifications" className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--line)] bg-[var(--paper)] shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4">
          <div>
            <p className="font-display text-xl">Notifications</p>
            <p className="text-xs text-[var(--muted)]">{unread} unread</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void api.post("/notifications/read-all").then(() => load())
              }
            >
              Mark all read
            </Button>
            <button type="button" onClick={onClose} className="rounded-md border border-[var(--line)] p-2">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`block w-full border-b border-[var(--line)] p-4 text-left hover:bg-white/60 ${item.readAt ? "opacity-70" : ""}`}
              onClick={() =>
                void api.post(`/notifications/${item.id}/read`).then(() => load())
              }
            >
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
              <p className="mt-2 text-[11px] text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p>
              {item.payload?.whatsappLink && (
                <a
                  href={item.payload.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-[var(--accent-strong)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open WhatsApp
                </a>
              )}
            </button>
          ))}
          {!items.length && <p className="p-6 text-sm text-[var(--muted)]">No notifications yet.</p>}
        </div>
      </aside>
    </div>
  );
}
