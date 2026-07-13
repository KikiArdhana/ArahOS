"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Progress,
  Segmented,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { BottomSheet, ConfirmSheet } from "@/components/ui/sheet";
import { useTable } from "@/hooks/use-table";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { Account, Allocation, Category, Transaction, Transfer } from "@/lib/types";

/* ----------------------------------------------------------------------------
   Design decisions (why this layout):
   1. ONE question answered up top: "How am I doing this month?" → big net
      number, income/expense beneath it. Month switcher scopes everything.
   2. ONE primary action: "Record" — expense, income, and transfer live inside
      the same sheet as a type choice. No competing buttons.
   3. ONE filter row: All / Expense / Income / Transfers chips. Transfers are
      records too, so they live in the same feed instead of a separate tab.
   4. Search is progressive disclosure: an icon that expands, not a permanent
      field pushing content down.
   5. Allocations are budgets, not records → tucked into a quiet card at the
      bottom that opens a management sheet.
---------------------------------------------------------------------------- */

type Kind = "all" | "expense" | "income" | "transfer";

type FeedEvent = {
  id: string;
  kind: "expense" | "income" | "transfer";
  title: string;
  subtitle: string;
  amount: number;
  occurred_at: string;
  raw: Transaction | Transfer;
};

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sameMonth(iso: string, d: Date) {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(iso, "long");
}

function TransactionsContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [month, setMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [kind, setKind] = React.useState<Kind>("all");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [recordSheet, setRecordSheet] = React.useState(false);
  const [allocationsOpen, setAllocationsOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<FeedEvent | null>(null);

  const accounts = useTable<Account>("accounts", {
    match: { is_archived: false },
    order: { column: "sort_order", ascending: true },
  });
  const categories = useTable<Category>("categories", {
    order: { column: "name", ascending: true },
  });
  const transactions = useTable<Transaction>("transactions", {
    select: "*, categories(name, icon), accounts(name)",
    order: { column: "occurred_at" },
    limit: 400,
  });
  const transfers = useTable<Transfer>("transfers", { order: { column: "occurred_at" } });
  const allocations = useTable<Allocation>("allocations", {
    order: { column: "created_at", ascending: true },
  });

  // Deep links (e.g. /transactions?new=transaction)
  React.useEffect(() => {
    if (params.get("new")) {
      setRecordSheet(true);
      router.replace("/transactions");
    }
  }, [params, router]);

  const accountById = React.useMemo(
    () => Object.fromEntries(accounts.items.map((a) => [a.id, a])),
    [accounts.items],
  );

  /* Month-scoped summary */
  const monthTx = transactions.items.filter((t) => sameMonth(t.occurred_at, month));
  const income = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const net = income - expense;

  /* Unified feed: transactions + transfers, month-scoped */
  const feed = React.useMemo<FeedEvent[]>(() => {
    const q = search.trim().toLowerCase();
    const list: FeedEvent[] = [];

    for (const t of transactions.items) {
      if (!sameMonth(t.occurred_at, month)) continue;
      list.push({
        id: `tx-${t.id}`,
        kind: t.type,
        title: t.note || t.categories?.name || "Transaction",
        subtitle: `${t.categories?.name ?? "Uncategorized"} · ${t.accounts?.name ?? ""}`,
        amount: Number(t.amount),
        occurred_at: t.occurred_at,
        raw: t,
      });
    }
    for (const t of transfers.items) {
      if (!sameMonth(t.occurred_at, month)) continue;
      list.push({
        id: `tr-${t.id}`,
        kind: "transfer",
        title: `${accountById[t.from_account_id]?.name ?? "Pocket"} → ${accountById[t.to_account_id]?.name ?? "Pocket"}`,
        subtitle: t.note || "Transfer between pockets",
        amount: Number(t.amount),
        occurred_at: t.occurred_at,
        raw: t,
      });
    }

    return list
      .filter((e) => kind === "all" || e.kind === kind)
      .filter(
        (e) => !q || e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q),
      )
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [transactions.items, transfers.items, accountById, month, kind, search]);

  /* Group by date */
  const grouped = React.useMemo(() => {
    const map = new Map<string, FeedEvent[]>();
    for (const e of feed) {
      const key = new Date(e.occurred_at).toDateString();
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [feed]);

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const isCurrentMonth = sameMonth(new Date().toISOString(), month);

  const deleteEvent = (e: FeedEvent) => {
    const table = e.kind === "transfer" ? transfers : transactions;
    table.remove.mutate(e.raw.id, {
      onSuccess: () => {
        toast.success(e.kind === "transfer" ? "Transfer deleted" : "Transaction deleted");
        setDeleting(null);
      },
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        subtitle="Every rupiah, recorded"
        action={
          <button
            type="button"
            aria-label={searchOpen ? "Close search" : "Search"}
            onClick={() => {
              setSearchOpen((v) => !v);
              setSearch("");
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-card"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
        }
      />

      {/* Search — appears only when asked for */}
      {searchOpen && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, category, pocket"
          />
        </motion.div>
      )}

      {/* Month summary — answers "how am I doing?" */}
      <Card className="rounded-4xl bg-foreground text-background">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-background/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-background/70">
            {monthLabel(month)}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-background/10 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-background/50">
          Net this month
        </p>
        <p
          className={cn(
            "text-center font-display text-3xl font-black tabular",
            net >= 0 ? "text-primary" : "text-red-400",
          )}
        >
          {formatMoney(net, { sign: true })}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-background/10 p-3 text-center">
            <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-background/60">
              <ArrowDownLeft className="h-3 w-3 text-primary" /> Income
            </p>
            <p className="mt-0.5 text-sm font-bold tabular">{formatMoney(income)}</p>
          </div>
          <div className="rounded-2xl bg-background/10 p-3 text-center">
            <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-background/60">
              <ArrowUpRight className="h-3 w-3 text-red-400" /> Expense
            </p>
            <p className="mt-0.5 text-sm font-bold tabular">{formatMoney(expense)}</p>
          </div>
        </div>
      </Card>

      {/* THE one action */}
      <Button size="lg" className="w-full" onClick={() => setRecordSheet(true)}>
        <Plus className="h-5 w-5" /> New Transaction
      </Button>

      {/* THE one filter row */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
        {(
          [
            { value: "all", label: "All" },
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfers" },
          ] as { value: Kind; label: string }[]
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setKind(o.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
              kind === o.value
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground shadow-card",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={search ? "No matches" : "Nothing recorded yet"}
          description={
            search
              ? "Try a different search term."
              : `Tap “Record” to add your first ${kind === "transfer" ? "transfer" : "transaction"} for ${monthLabel(month)}.`
          }
        />
      ) : (
        grouped.map(([key, list]) => {
          const dayNet = list
            .filter((e) => e.kind !== "transfer")
            .reduce((s, e) => s + (e.kind === "income" ? e.amount : -e.amount), 0);
          return (
            <section key={key}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {dateLabel(list[0].occurred_at)}
                </h2>
                {dayNet !== 0 && (
                  <span
                    className={cn(
                      "text-xs font-bold tabular",
                      dayNet > 0 ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {formatMoney(dayNet, { sign: true })}
                  </span>
                )}
              </div>
              <Card className="divide-y divide-border rounded-3xl p-0">
                {list.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        e.kind === "transfer"
                          ? "bg-accent text-accent-foreground"
                          : e.kind === "income"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                            : "bg-secondary",
                      )}
                    >
                      {e.kind === "transfer" ? (
                        <ArrowLeftRight className="h-4 w-4" />
                      ) : e.kind === "income" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.subtitle}</p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-sm font-bold tabular",
                        e.kind === "income"
                          ? "text-success"
                          : e.kind === "transfer"
                            ? "text-muted-foreground"
                            : "",
                      )}
                    >
                      {e.kind === "income" ? "+" : e.kind === "expense" ? "−" : ""}
                      {formatMoney(e.amount)}
                    </p>
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={() => setDeleting(e)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </Card>
            </section>
          );
        })
      )}

      {/* Allocations — budgets, not records, so they stay out of the feed */}
      <button
        type="button"
        onClick={() => setAllocationsOpen(true)}
        className="flex w-full items-center justify-between rounded-3xl bg-card px-4 py-3.5 shadow-card"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent">
            <PiggyBank className="h-4 w-4 text-accent-foreground" />
          </span>
          <span className="text-left">
            <span className="block text-sm font-semibold">Allocations</span>
            <span className="block text-xs text-muted-foreground">
              {allocations.items.length === 0
                ? "Set aside money for a purpose"
                : `${allocations.items.length} envelope${allocations.items.length > 1 ? "s" : ""}`}
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* ---------- Record sheet: expense / income / transfer in ONE place ---------- */}
      <RecordSheet
        open={recordSheet}
        onClose={() => setRecordSheet(false)}
        accounts={accounts.items}
        categories={categories.items}
        onSubmitTransaction={async (v) => {
          await transactions.insert.mutateAsync(v);
          toast.success(v.type === "income" ? "Income recorded" : "Expense recorded");
          setRecordSheet(false);
        }}
        onSubmitTransfer={async (v) => {
          await transfers.insert.mutateAsync(v);
          toast.success("Transfer recorded");
          setRecordSheet(false);
        }}
      />

      {/* Allocations manager */}
      <AllocationsSheet
        open={allocationsOpen}
        onClose={() => setAllocationsOpen(false)}
        accounts={accounts.items}
        allocations={allocations.items}
        onCreate={async (v) => {
          await allocations.insert.mutateAsync(v);
          toast.success("Allocation created");
        }}
        onRemove={(id) =>
          allocations.remove.mutate(id, { onSuccess: () => toast.success("Allocation removed") })
        }
      />

      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting?.kind === "transfer" ? "Delete transfer?" : "Delete transaction?"}
        description="Pocket balances will be adjusted back automatically."
        loading={transactions.remove.isPending || transfers.remove.isPending}
        onConfirm={() => deleting && deleteEvent(deleting)}
      />
    </div>
  );
}

/* ------------------------------ Record sheet -------------------------------- */

type RecordType = "expense" | "income" | "transfer";

function RecordSheet({
  open,
  onClose,
  accounts,
  categories,
  onSubmitTransaction,
  onSubmitTransfer,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onSubmitTransaction: (v: Record<string, unknown> & { type: string }) => Promise<void>;
  onSubmitTransfer: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [type, setType] = React.useState<RecordType>("expense");
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = React.useState(false);

  const cats = categories.filter((c) => c.kind === type);

  React.useEffect(() => {
    if (!open) {
      setAmount("");
      setNote("");
      setCategoryId("");
    }
  }, [open]);

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount greater than zero");
    const fromId = accountId || accounts[0]?.id;
    if (!fromId) return toast.error("Create a pocket first (Money page)");

    setBusy(true);
    try {
      if (type === "transfer") {
        const toId = toAccountId || accounts[1]?.id;
        if (!toId) return toast.error("You need two pockets to transfer");
        if (fromId === toId) return toast.error("Pick two different pockets");
        await onSubmitTransfer({
          from_account_id: fromId,
          to_account_id: toId,
          amount: value,
          note: note || null,
          occurred_at: new Date(date + "T12:00:00").toISOString(),
        });
      } else {
        await onSubmitTransaction({
          type,
          amount: value,
          account_id: fromId,
          category_id: categoryId || null,
          note: note || null,
          occurred_at: new Date(date + "T12:00:00").toISOString(),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Record">
      <div className="space-y-4">
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v);
            setCategoryId("");
          }}
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfer" },
          ]}
        />

        <Field label="Amount">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field label={type === "transfer" ? "From pocket" : "Pocket"}>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.owner?.trim() ? `${a.owner} · ` : ""}
                {a.name}
                {type === "transfer" ? ` · ${formatMoney(Number(a.balance))}` : ""}
              </option>
            ))}
          </Select>
        </Field>

        {type === "transfer" ? (
          <Field label="To pocket">
            <Select
              value={toAccountId || accounts[1]?.id || ""}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.owner?.trim() ? `${a.owner} · ` : ""}
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note">
          <Textarea
            placeholder={type === "transfer" ? "Optional" : "What was this for?"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          {type === "expense"
            ? "Save expense"
            : type === "income"
              ? "Save income"
              : "Move money"}
        </Button>
      </div>
    </BottomSheet>
  );
}

/* ----------------------------- Allocations sheet ---------------------------- */

function AllocationsSheet({
  open,
  onClose,
  accounts,
  allocations,
  onCreate,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  allocations: Allocation[];
  onCreate: (v: Record<string, unknown>) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [current, setCurrent] = React.useState("");
  const [period, setPeriod] = React.useState("monthly");
  const [accountId, setAccountId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the allocation a name");
    const t = Number(target);
    if (!t || t <= 0) return toast.error("Set a target amount");
    setBusy(true);
    try {
      await onCreate({
        name: name.trim(),
        target_amount: t,
        current_amount: Number(current) || 0,
        period,
        account_id: accountId || null,
      });
      setName("");
      setTarget("");
      setCurrent("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Allocations">
      {!creating ? (
        <div className="space-y-3">
          {allocations.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Envelopes for money with a purpose — groceries, fun, savings.
            </p>
          ) : (
            allocations.map((a) => {
              const pct = a.target_amount > 0 ? (a.current_amount / a.target_amount) * 100 : 0;
              return (
                <div key={a.id} className="rounded-2xl bg-secondary/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{a.name}</p>
                    <Badge>{a.period}</Badge>
                  </div>
                  <Progress value={pct} className="mt-2" />
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular">
                      {formatMoney(Number(a.current_amount))} of{" "}
                      {formatMoney(Number(a.target_amount))}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(a.id)}
                      className="font-semibold text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
          <Button size="lg" className="w-full" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New allocation
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Name">
            <Input
              placeholder="e.g. Groceries"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Target amount">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label="Already set aside">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="Period">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="none">One-off</option>
            </Select>
          </Field>
          <Field label="Linked pocket">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setCreating(false)}
            >
              Back
            </Button>
            <Button size="lg" className="flex-1" loading={busy} onClick={submit}>
              Create
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

export default function TransactionsPage() {
  return (
    <React.Suspense>
      <TransactionsContent />
    </React.Suspense>
  );
}