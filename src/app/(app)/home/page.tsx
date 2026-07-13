"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Bell, ChevronRight, Target } from "lucide-react";
import { Badge, Card, Progress, Skeleton } from "@/components/ui/primitives";
import { useTable } from "@/hooks/use-table";
import { useProfile } from "@/hooks/use-profile";
import { cn, daysUntil, dueLabel, formatDate, formatMoney, greeting } from "@/lib/utils";
import type {
  Account,
  AppNotification,
  Asset,
  Bill,
  Debt,
  Goal,
  Maintenance,
  Transaction,
} from "@/lib/types";

function useClock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ------------------------- Apple-style emoji everywhere --------------------- */
/* Renders Apple's emoji artwork on any OS (Windows/Android included) via CDN.  */

function AppleEmoji({
  emoji,
  size = 26,
  className,
}: {
  emoji: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <span className={className} style={{ fontSize: size, lineHeight: 1 }}>
        {emoji}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=apple`}
      alt={emoji}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("select-none", className)}
    />
  );
}

/* ----------------------- Goal icon (emoji / image / default) ---------------- */

function isImageIcon(icon: string | null | undefined) {
  return Boolean(icon && icon.startsWith("data:image"));
}

function isEmojiIcon(icon: string | null | undefined) {
  return Boolean(icon && !isImageIcon(icon) && icon.length <= 16 && icon !== "target");
}

function GoalIcon({ icon, size = 24 }: { icon: string | null | undefined; size?: number }) {
  if (isImageIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={icon!} alt="" className="h-full w-full rounded-2xl object-cover" />
    );
  }
  if (isEmojiIcon(icon)) {
    return <AppleEmoji emoji={icon!} size={size} />;
  }
  return <Target className="h-5 w-5 text-accent-foreground" />;
}

/* --------------------------------- Menu grid -------------------------------- */

const MENU = [
  { href: "/money", label: "Money", emoji: "💵", tint: "bg-lime-100" },
  { href: "/goals", label: "Goals", emoji: "🎯", tint: "bg-orange-100" },
  { href: "/assets", label: "Assets", emoji: "💎", tint: "bg-sky-100" },
  { href: "/debts", label: "Debts", emoji: "🤝", tint: "bg-amber-100" },
  { href: "/bills", label: "Bills", emoji: "🧾", tint: "bg-violet-100" },
  { href: "/maintenance", label: "Care", emoji: "🔧", tint: "bg-rose-100" },
];

/* ---------------------------------- Page ------------------------------------ */

export default function HomePage() {
  const now = useClock();
  const { profile } = useProfile();

  const accounts = useTable<Account>("accounts", { match: { is_archived: false } });
  const assets = useTable<Asset>("assets", { match: { status: "active" } });
  const debts = useTable<Debt>("debts", { match: { status: "open" } });
  const goals = useTable<Goal>("goals", { match: { status: "active" }, limit: 6 });
  const bills = useTable<Bill>("bills", {
    match: { is_active: true },
    order: { column: "next_due_date", ascending: true },
    limit: 5,
  });
  const maintenance = useTable<Maintenance>("maintenance", {
    match: { is_active: true },
    order: { column: "next_due_date", ascending: true },
    limit: 5,
  });
  const transactions = useTable<Transaction>("transactions", {
    select: "*, categories(name, icon), accounts(name)",
    order: { column: "occurred_at" },
    limit: 100,
  });
  const notifications = useTable<AppNotification>("notifications", {
    match: { status: "unread" },
  });

  const cashTotal = accounts.items.reduce((s, a) => s + Number(a.balance), 0);
  const assetTotal = assets.items.reduce((s, a) => s + Number(a.value), 0);
  const theyOwe = debts.items
    .filter((d) => d.direction === "they_owe")
    .reduce((s, d) => s + (Number(d.amount) - Number(d.paid_amount)), 0);
  const iOwe = debts.items
    .filter((d) => d.direction === "i_owe")
    .reduce((s, d) => s + (Number(d.amount) - Number(d.paid_amount)), 0);
  const netWorth = cashTotal + assetTotal + theyOwe - iOwe;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTx = transactions.items.filter((t) => new Date(t.occurred_at) >= monthStart);
  const income = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  /* One unified "Reminders" feed: bills + maintenance + debts with due dates */
  const reminders = React.useMemo(() => {
    const items: {
      id: string;
      emoji: string;
      title: string;
      date: string;
      amount: number | null;
      href: string;
    }[] = [];
    for (const b of bills.items)
      items.push({
        id: `bill-${b.id}`,
        emoji: "🧾",
        title: b.name,
        date: b.next_due_date,
        amount: Number(b.amount),
        href: "/bills",
      });
    for (const m of maintenance.items)
      items.push({
        id: `care-${m.id}`,
        emoji: "🔧",
        title: m.name,
        date: m.next_due_date,
        amount: m.estimated_cost != null ? Number(m.estimated_cost) : null,
        href: "/maintenance",
      });
    for (const d of debts.items) {
      if (!d.due_date) continue;
      items.push({
        id: `debt-${d.id}`,
        emoji: "🤝",
        title: d.direction === "i_owe" ? `Pay ${d.counterparty}` : `${d.counterparty} pays you`,
        date: d.due_date,
        amount: Number(d.amount) - Number(d.paid_amount),
        href: "/debts",
      });
    }
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [bills.items, maintenance.items, debts.items]);

  const loading = accounts.isLoading || assets.isLoading;
  const unread = notifications.items.length;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground tabular">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
            {formatDate(now, "long")}
          </p>
          <h1 className="font-display text-2xl font-black tracking-tight">
            {greeting(now)}, {profile?.display_name?.split(" ")[0] ?? "there"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inbox"
            aria-label={`Inbox, ${unread} unread`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-foreground text-background shadow-card"
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-sm font-bold">
                {(profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Net worth hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden bg-foreground text-background">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-primary/25 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-widest text-background/60">
            Net worth
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-48 bg-background/20" />
          ) : (
            <p className="mt-2 font-display text-4xl font-black tracking-tight tabular">
              {formatMoney(netWorth)}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-background/70">
                <ArrowDownLeft className="h-3.5 w-3.5 text-primary" /> Income · month
              </div>
              <p className="mt-1 font-semibold tabular">{formatMoney(income)}</p>
            </div>
            <div className="rounded-2xl bg-background/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-background/70">
                <ArrowUpRight className="h-3.5 w-3.5 text-red-400" /> Spent · month
              </div>
              <p className="mt-1 font-semibold tabular">{formatMoney(expense)}</p>
            </div>
          </div>
        </Card>
      </motion.div>

  {/* Menu grid — e-wallet style: floating icons on one clean card */}
<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
  <Card
  className="
    rounded-2xl
    bg-white
    border border-zinc-200/70
    shadow-sm
    hover:border-emerald-200
    hover:shadow-md
    hover:-translate-y-0.5
    transition-all duration-300 ease-out
    cursor-pointer
    px-3 py-3
  "
>
    <div className="grid grid-cols-3">
      {MENU.map((m, i) => (
        <motion.div
          key={m.href}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 * i }}
        >
          <Link
            href={m.href}
            className="group flex flex-col items-center gap-2 rounded-2xl py-4 transition-all active:scale-90"
          >
            <AppleEmoji
              emoji={m.emoji}
              size={34}
              className="drop-shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-110"
            />
            <span className="text-xs font-semibold tracking-tight text-foreground">
              {m.label}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  </Card>
</motion.div>

      {/* Goals — horizontal swipe cards */}
      {goals.items.length > 0 && (
        <section>
          <SectionHeader title="Goals" href="/goals" />
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
            {goals.items.map((g, i) => {
              const pct = Math.min(
                (Number(g.current_amount) / Number(g.target_amount)) * 100,
                100,
              );
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="shrink-0 snap-start"
                >
                  <Link href="/goals">
                  <Card
  className="
    w-44
    rounded-3xl
    bg-white
    border border-green-200/60
    shadow-[0_4px_20px_rgba(34,197,94,0.08),0_1px_2px_rgba(0,0,0,0.03)]
    transition-all
    duration-300
    p-4
  "
>
                      <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-accent">
                        <GoalIcon icon={g.icon} size={26} />
                      </span>
                      <p className="mt-3 truncate text-sm font-semibold">{g.name}</p>
                      <p className="text-[11px] text-muted-foreground tabular">
                        {formatMoney(Number(g.current_amount), { compact: true })} /{" "}
                        {formatMoney(Number(g.target_amount), { compact: true })}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-[11px] font-bold tabular">{Math.round(pct)}%</span>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reminders — bills, maintenance & debts in one feed */}
      {reminders.length > 0 && (
        <section>
          <SectionHeader title="Reminders" href="/inbox" />
          <Card className="divide-y divide-border rounded-3xl p-0">
            {reminders.map((r) => {
              const d = daysUntil(r.date);
              return (
                <Link
                  key={r.id}
                  href={r.href}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-secondary/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                    <AppleEmoji emoji={r.emoji} size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.date)}
                      {r.amount != null && (
                        <span className="tabular"> · {formatMoney(r.amount, { compact: true })}</span>
                      )}
                    </p>
                  </div>
                  <Badge variant={d < 0 ? "danger" : d <= 3 ? "warning" : "default"}>
                    {dueLabel(r.date)}
                  </Badge>
                </Link>
              );
            })}
          </Card>
        </section>
      )}

      {/* Recent activity */}
      <section>
        <SectionHeader title="Recent activity" href="/money" />
        {transactions.items.length === 0 ? (
          <Card className="rounded-3xl py-8 text-center text-sm text-muted-foreground">
            No transactions yet. Tap + to record your first one.
          </Card>
        ) : (
          <Card className="divide-y divide-border rounded-3xl p-0">
            {transactions.items.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      t.type === "income"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    {t.type === "income" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {t.note || t.categories?.name || "Transaction"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.accounts?.name} · {formatDate(t.occurred_at)}
                    </p>
                  </div>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-bold tabular",
                    t.type === "income" ? "text-success" : "",
                  )}
                >
                  {t.type === "income" ? "+" : "−"}
                  {formatMoney(Number(t.amount))}
                </p>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-base font-bold">{title}</h2>
      <Link
        href={href}
        className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        See all <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}