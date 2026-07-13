"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Eye,
  EyeOff,
  History,
  Landmark as LandmarkIcon,
  Plus,
  Smartphone,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button, Card, Field, Input, Select, Skeleton } from "@/components/ui/primitives";
import { BottomSheet, ConfirmSheet } from "@/components/ui/sheet";
import { useTable } from "@/hooks/use-table";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { Account, Transaction, Transfer } from "@/lib/types";

const ACCOUNT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bank: LandmarkIcon,
  cash: Banknote,
  ewallet: Smartphone,
  investment: TrendingUp,
  other: Wallet,
};

/* Pastel palette for pocket cards */
const POCKET_COLORS = ["#EDE7FF", "#FFF3D6", "#DFF5FF", "#FFE4EC", "#EAF7D9", "#F1F1EC"];

export default function MoneyPage() {
  const [ownerFilter, setOwnerFilter] = React.useState<string>("All");
  const [hideBalance, setHideBalance] = React.useState(false);
  const [accountSheet, setAccountSheet] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = React.useState<Account | null>(null);
  const [historyAccount, setHistoryAccount] = React.useState<Account | null>(null);

  const accounts = useTable<Account>("accounts", {
    match: { is_archived: false },
    order: { column: "sort_order", ascending: true },
  });
  const transactions = useTable<Transaction>("transactions", {
    select: "*, categories(name, icon), accounts(name)",
    order: { column: "occurred_at" },
    limit: 300,
  });
  const transfers = useTable<Transfer>("transfers", { order: { column: "occurred_at" } });

  const accountById = React.useMemo(
    () => Object.fromEntries(accounts.items.map((a) => [a.id, a])),
    [accounts.items],
  );

  const owners = React.useMemo(
    () => [...new Set(accounts.items.map((a) => a.owner?.trim() || "Personal"))],
    [accounts.items],
  );

  const visibleAccounts = accounts.items.filter(
    (a) => ownerFilter === "All" || (a.owner?.trim() || "Personal") === ownerFilter,
  );
  const filteredTotal = visibleAccounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Money"
        subtitle="Your pockets, at a glance"
        action={
          <Link
            href="/transactions"
            aria-label="All transactions"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-card"
          >
            <History className="h-4 w-4" />
          </Link>
        }
      />

      {/* Total balance */}
      <Card className="rounded-3xl">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total balance {ownerFilter !== "All" && `· ${ownerFilter}`}
          </p>
          <button
            type="button"
            aria-label={hideBalance ? "Show balance" : "Hide balance"}
            onClick={() => setHideBalance((v) => !v)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-0.5 font-display text-2xl font-black tabular">
          {hideBalance ? "Rp ••••••••" : formatMoney(filteredTotal)}
        </p>
      </Card>

      {/* Owner filter chips */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
        {["All", ...owners].map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOwnerFilter(o)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
              ownerFilter === o
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground shadow-card",
            )}
          >
            {o}
          </button>
        ))}
      </div>

      {/* Pocket grid */}
      {accounts.isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleAccounts.map((a, i) => {
            const Icon = ACCOUNT_ICONS[a.type] ?? Wallet;
            const tint = a.color?.startsWith("#") && a.color.length === 7 ? a.color : "#F1F1EC";
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                whileTap={{ scale: 0.97 }}
                className="relative rounded-3xl p-4 shadow-card"
                style={{ backgroundColor: tint }}
              >
                {/* History shortcut for this pocket */}
                <button
                  type="button"
                  aria-label={`History of ${a.name}`}
                  onClick={() => setHistoryAccount(a)}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-foreground shadow-card transition-transform active:scale-90"
                >
                  <History className="h-3.5 w-3.5" />
                </button>

                {/* Tap the rest of the card to edit */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingAccount(a);
                    setAccountSheet(true);
                  }}
                  className="block w-full text-left"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Icon className="h-5 w-5 text-foreground" />
                  </span>
                  <p className="mt-3 truncate text-sm font-semibold text-foreground">{a.name}</p>
                  <p className="text-[11px] text-foreground/60">
                    {a.owner?.trim() || "Personal"} · <span className="capitalize">{a.type}</span>
                  </p>
                  <p className="mt-1 truncate font-display text-base font-bold text-foreground tabular">
                    {hideBalance ? "••••••" : formatMoney(Number(a.balance))}
                  </p>
                </button>
              </motion.div>
            );
          })}

          {/* Create new pocket */}
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setAccountSheet(true);
            }}
            className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
              <Plus className="h-4 w-4" />
            </span>
            Create new
          </button>
        </div>
      )}

      {/* Shortcut to full history */}
      <Link
        href="/transactions"
        className="flex items-center justify-between rounded-3xl bg-card px-4 py-3.5 shadow-card"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent">
            <ArrowLeftRight className="h-4 w-4 text-accent-foreground" />
          </span>
          <span>
            <span className="block text-sm font-semibold">All transactions</span>
            <span className="block text-xs text-muted-foreground">
              History, transfers & allocations
            </span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      {/* Per-pocket history */}
      <PocketHistorySheet
        account={historyAccount}
        transactions={transactions.items}
        transfers={transfers.items}
        accountById={accountById}
        onClose={() => setHistoryAccount(null)}
      />

      {/* Create / edit pocket */}
      <AccountSheet
        open={accountSheet}
        account={editingAccount}
        existingOwners={owners}
        onClose={() => {
          setAccountSheet(false);
          setEditingAccount(null);
        }}
        onDelete={() => {
          setAccountSheet(false);
          setDeleteAccount(editingAccount);
        }}
        onSubmit={async (v) => {
          if (editingAccount) {
            await accounts.update.mutateAsync({ id: editingAccount.id, ...v });
            toast.success("Pocket updated");
          } else {
            await accounts.insert.mutateAsync(v);
            toast.success("Pocket created");
          }
          setAccountSheet(false);
          setEditingAccount(null);
        }}
      />

      <ConfirmSheet
        open={Boolean(deleteAccount)}
        onClose={() => setDeleteAccount(null)}
        title={`Delete ${deleteAccount?.name ?? "pocket"}?`}
        description="This permanently removes the pocket AND every transaction recorded in it. This cannot be undone."
        loading={accounts.remove.isPending}
        onConfirm={() =>
          deleteAccount &&
          accounts.remove.mutate(deleteAccount.id, {
            onSuccess: () => {
              toast.success("Pocket deleted");
              setDeleteAccount(null);
              setEditingAccount(null);
            },
          })
        }
      />
    </div>
  );
}

/* --------------------------- Per-pocket history ----------------------------- */

type PocketEvent = {
  id: string;
  kind: "income" | "expense" | "transfer_in" | "transfer_out";
  title: string;
  subtitle: string;
  amount: number;
  occurred_at: string;
};

function PocketHistorySheet({
  account,
  transactions,
  transfers,
  accountById,
  onClose,
}: {
  account: Account | null;
  transactions: Transaction[];
  transfers: Transfer[];
  accountById: Record<string, Account>;
  onClose: () => void;
}) {
  const events = React.useMemo<PocketEvent[]>(() => {
    if (!account) return [];
    const list: PocketEvent[] = [];

    for (const t of transactions) {
      if (t.account_id !== account.id) continue;
      list.push({
        id: `tx-${t.id}`,
        kind: t.type,
        title: t.note || t.categories?.name || "Transaction",
        subtitle: `${t.categories?.name ?? "Uncategorized"} · ${formatDate(t.occurred_at)}`,
        amount: Number(t.amount),
        occurred_at: t.occurred_at,
      });
    }

    for (const t of transfers) {
      if (t.from_account_id === account.id) {
        list.push({
          id: `tr-out-${t.id}`,
          kind: "transfer_out",
          title: `Transfer to ${accountById[t.to_account_id]?.name ?? "pocket"}`,
          subtitle: `${t.note || "Transfer"} · ${formatDate(t.occurred_at)}`,
          amount: Number(t.amount),
          occurred_at: t.occurred_at,
        });
      }
      if (t.to_account_id === account.id) {
        list.push({
          id: `tr-in-${t.id}`,
          kind: "transfer_in",
          title: `Transfer from ${accountById[t.from_account_id]?.name ?? "pocket"}`,
          subtitle: `${t.note || "Transfer"} · ${formatDate(t.occurred_at)}`,
          amount: Number(t.amount),
          occurred_at: t.occurred_at,
        });
      }
    }

    return list.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [account, transactions, transfers, accountById]);

  const inflow = events
    .filter((e) => e.kind === "income" || e.kind === "transfer_in")
    .reduce((s, e) => s + e.amount, 0);
  const outflow = events
    .filter((e) => e.kind === "expense" || e.kind === "transfer_out")
    .reduce((s, e) => s + e.amount, 0);

  return (
    <BottomSheet
      open={Boolean(account)}
      onClose={onClose}
      title={account ? `${account.name} · history` : "History"}
    >
      {account && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-secondary p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">Money in</p>
            <p className="text-sm font-bold text-success tabular">{formatMoney(inflow)}</p>
          </div>
          <div className="rounded-2xl bg-secondary p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">Money out</p>
            <p className="text-sm font-bold text-destructive tabular">{formatMoney(outflow)}</p>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No activity in this pocket yet.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {events.map((e) => {
            const positive = e.kind === "income" || e.kind === "transfer_in";
            const isTransfer = e.kind.startsWith("transfer");
            return (
              <div key={e.id} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    isTransfer
                      ? "bg-accent text-accent-foreground"
                      : positive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-secondary",
                  )}
                >
                  {isTransfer ? (
                    <ArrowLeftRight className="h-4 w-4" />
                  ) : positive ? (
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
                    positive ? "text-success" : "",
                  )}
                >
                  {positive ? "+" : "−"}
                  {formatMoney(e.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}

/* ------------------------------ Pocket form -------------------------------- */

function AccountSheet({
  open,
  account,
  existingOwners,
  onClose,
  onDelete,
  onSubmit,
}: {
  open: boolean;
  account: Account | null;
  existingOwners: string[];
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("bank");
  const [owner, setOwner] = React.useState("Personal");
  const [color, setColor] = React.useState(POCKET_COLORS[0]);
  const [balance, setBalance] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const ownerOptions = React.useMemo(
    () => [...new Set(["Personal", ...existingOwners])],
    [existingOwners],
  );

  React.useEffect(() => {
    setName(account?.name ?? "");
    setType(account?.type ?? "bank");
    setOwner(account?.owner?.trim() || "Personal");
    setColor(
      account?.color?.startsWith("#") && account.color.length === 7
        ? account.color
        : POCKET_COLORS[0],
    );
    setBalance(account ? String(account.balance) : "");
  }, [account, open]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the pocket a name");
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        type,
        owner: owner.trim() || "Personal",
        color,
        balance: Number(balance) || 0,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={account ? "Edit pocket" : "New pocket"}>
      <div className="space-y-4">
        <Field label="Name">
          <Input
            placeholder="e.g. BCA, Cash, GoPay"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Whose money is this?">
          <Input
            list="owner-suggestions"
            placeholder="e.g. Personal, Keluarga, Mama, Bisnis"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
          <datalist id="owner-suggestions">
            {ownerOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ownerOptions.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOwner(o)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  owner === o ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Card color">
          <div className="flex gap-2">
            {POCKET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "h-9 w-9 rounded-full border transition-transform active:scale-90",
                  color === c ? "border-foreground ring-2 ring-foreground/20" : "border-border",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="ewallet">E-wallet</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label={account ? "Balance (adjust manually)" : "Starting balance"}>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          {account ? "Save changes" : "Create pocket"}
        </Button>
        {account && (
          <Button variant="destructive" size="lg" className="w-full" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete pocket
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}