"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Archive, Bell, CheckCheck, HandCoins, PartyPopper, Receipt, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button, Card, EmptyState, Segmented } from "@/components/ui/primitives";
import { useTable } from "@/hooks/use-table";
import { cn, formatDate } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/lib/types";

type Tab = "unread" | "read" | "archived";

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  bill: Receipt,
  debt: HandCoins,
  maintenance: Wrench,
  goal: PartyPopper,
  system: Bell,
};

export default function InboxPage() {
  const [tab, setTab] = React.useState<Tab>("unread");
  const notifications = useTable<AppNotification>("notifications");

  const visible = notifications.items.filter((n) => n.status === tab);
  const unreadCount = notifications.items.filter((n) => n.status === "unread").length;

  const markAllRead = () => {
    notifications.items
      .filter((n) => n.status === "unread")
      .forEach((n) => notifications.update.mutate({ id: n.id, status: "read" }));
    toast.success("All caught up");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
        action={
          unreadCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> Read all
            </Button>
          ) : undefined
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "unread", label: "Unread" },
          { value: "read", label: "Read" },
          { value: "archived", label: "Archived" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={tab === "unread" ? "Inbox zero" : `No ${tab} notifications`}
          description="Bill, debt, and maintenance reminders arrive here automatically."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((n, i) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className={cn(
                    "flex items-start gap-3 rounded-3xl p-4",
                    n.status === "unread" && "ring-1 ring-primary/60",
                  )}
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent">
                    <Icon className="h-4.5 w-4.5 text-accent-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(n.created_at)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {n.status === "unread" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => notifications.update.mutate({ id: n.id, status: "read" })}
                        >
                          Mark read
                        </Button>
                      )}
                      {n.status !== "archived" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            notifications.update.mutate(
                              { id: n.id, status: "archived" },
                              { onSuccess: () => toast.success("Archived") },
                            )
                          }
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            notifications.remove.mutate(n.id, {
                              onSuccess: () => toast.success("Deleted"),
                            })
                          }
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
