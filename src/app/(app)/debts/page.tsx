"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { HandCoins, Plus, Trash2 } from "lucide-react";
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
  Textarea,
} from "@/components/ui/primitives";
import { BottomSheet, ConfirmSheet } from "@/components/ui/sheet";
import { useTable } from "@/hooks/use-table";
import { dueLabel, formatDate, formatMoney } from "@/lib/utils";
import type { Debt, DebtDirection, DebtPayment } from "@/lib/types";

type Tab = "i_owe" | "they_owe" | "history";

export default function DebtsPage() {
  const [tab, setTab] = React.useState<Tab>("i_owe");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [payDebt, setPayDebt] = React.useState<Debt | null>(null);
  const [historyDebt, setHistoryDebt] = React.useState<Debt | null>(null);
  const [deleting, setDeleting] = React.useState<Debt | null>(null);

  const debts = useTable<Debt>("debts");
  const payments = useTable<DebtPayment>("debt_payments", { order: { column: "occurred_at" } });

  const open = debts.items.filter((d) => d.status === "open");
  const settled = debts.items.filter((d) => d.status === "settled");
  const iOweTotal = open
    .filter((d) => d.direction === "i_owe")
    .reduce((s, d) => s + Number(d.amount) - Number(d.paid_amount), 0);
  const theyOweTotal = open
    .filter((d) => d.direction === "they_owe")
    .reduce((s, d) => s + Number(d.amount) - Number(d.paid_amount), 0);

  const visible = tab === "history" ? settled : open.filter((d) => d.direction === tab);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Debts"
        subtitle="Keep every promise on record"
        action={
          <Button
            variant="dark"
            size="icon"
            aria-label="Add debt"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-3xl">
            <p className="text-xs font-semibold text-muted-foreground">I owe</p>
            <p className="mt-1 truncate font-display text-xl font-black text-destructive tabular">
              {formatMoney(iOweTotal)}
            </p>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="rounded-3xl">
            <p className="text-xs font-semibold text-muted-foreground">They owe me</p>
            <p className="mt-1 truncate font-display text-xl font-black text-success tabular">
              {formatMoney(theyOweTotal)}
            </p>
          </Card>
        </motion.div>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "i_owe", label: "I owe" },
          { value: "they_owe", label: "They owe" },
          { value: "history", label: "History" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={tab === "history" ? "No settled debts yet" : "All clear"}
          description={
            tab === "history"
              ? "Fully paid debts move here."
              : "Nothing outstanding in this direction. Nice."
          }
        />
      ) : (
        visible.map((d) => {
          const remaining = Number(d.amount) - Number(d.paid_amount);
          const pct = (Number(d.paid_amount) / Number(d.amount)) * 100;
          return (
            <Card key={d.id} className="rounded-3xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{d.counterparty}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.note || (d.direction === "i_owe" ? "You borrowed" : "You lent")}
                    {d.due_date ? ` · due ${formatDate(d.due_date)}` : ""}
                  </p>
                </div>
                {d.status === "settled" ? (
                  <Badge variant="success">Settled</Badge>
                ) : d.due_date ? (
                  <Badge
                    variant={
                      new Date(d.due_date) < new Date()
                        ? "danger"
                        : dueLabel(d.due_date).startsWith("Due")
                          ? "warning"
                          : "default"
                    }
                  >
                    {dueLabel(d.due_date)}
                  </Badge>
                ) : null}
              </div>

              <Progress value={pct} className="mt-3" />
              <div className="mt-2 flex items-baseline justify-between text-xs text-muted-foreground">
                <span className="tabular">
                  Paid {formatMoney(Number(d.paid_amount))} of {formatMoney(Number(d.amount))}
                </span>
                {d.status === "open" && (
                  <span className="font-bold text-foreground tabular">
                    {formatMoney(remaining)} left
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {d.status === "open" && (
                  <Button size="sm" onClick={() => setPayDebt(d)}>
                    Record payment
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setHistoryDebt(d)}>
                  Payments
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(d)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </Card>
          );
        })
      )}

      {/* Create */}
      <CreateDebtSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (v) => {
          await debts.insert.mutateAsync(v);
          toast.success("Debt recorded");
          setCreateOpen(false);
        }}
      />

      {/* Payment */}
      <PaymentSheet
        debt={payDebt}
        onClose={() => setPayDebt(null)}
        onSubmit={async (v) => {
          const d = payDebt!;
          await payments.insert.mutateAsync(v);
          const settledNow = Number(d.paid_amount) + Number(v.amount) >= Number(d.amount);
          toast.success(settledNow ? `Settled with ${d.counterparty} 🤝` : "Payment recorded");
          setPayDebt(null);
        }}
      />

      {/* Payment history */}
      <BottomSheet
        open={Boolean(historyDebt)}
        onClose={() => setHistoryDebt(null)}
        title={historyDebt ? `${historyDebt.counterparty} · payments` : "Payments"}
      >
        {(() => {
          const rows = payments.items.filter((p) => p.debt_id === historyDebt?.id);
          if (rows.length === 0)
            return (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
            );
          return (
            <div className="divide-y divide-border">
              {rows.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold tabular">{formatMoney(Number(p.amount))}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.note || "Payment"} · {formatDate(p.occurred_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete payment"
                    onClick={() =>
                      payments.remove.mutate(p.id, {
                        onSuccess: () => toast.success("Payment removed"),
                      })
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </BottomSheet>

      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete debt?"
        description="The debt and its payment history will be removed permanently."
        loading={debts.remove.isPending}
        onConfirm={() =>
          deleting &&
          debts.remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Debt deleted");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

function CreateDebtSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [direction, setDirection] = React.useState<DebtDirection>("i_owe");
  const [counterparty, setCounterparty] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!counterparty.trim()) return toast.error("Who is this with?");
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount greater than zero");
    setBusy(true);
    try {
      await onSubmit({
        direction,
        counterparty: counterparty.trim(),
        amount: value,
        due_date: dueDate || null,
        note: note || null,
      });
      setCounterparty("");
      setAmount("");
      setDueDate("");
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="New debt">
      <div className="space-y-4">
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: "i_owe", label: "I owe them" },
            { value: "they_owe", label: "They owe me" },
          ]}
        />
        <Field label="Person or company">
          <Input
            placeholder="e.g. Andi"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </Field>
        <Field label="Amount">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Due date (optional)">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Note">
          <Textarea
            placeholder="What was it for?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          Save debt
        </Button>
      </div>
    </BottomSheet>
  );
}

function PaymentSheet({
  debt,
  onClose,
  onSubmit,
}: {
  debt: Debt | null;
  onClose: () => void;
  onSubmit: (v: { debt_id: string; amount: number; note: string | null }) => Promise<void>;
}) {
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const remaining = debt ? Number(debt.amount) - Number(debt.paid_amount) : 0;

  const submit = async () => {
    if (!debt) return;
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount greater than zero");
    setBusy(true);
    try {
      await onSubmit({ debt_id: debt.id, amount: value, note: note || null });
      setAmount("");
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={Boolean(debt)}
      onClose={onClose}
      title={debt ? `Payment · ${debt.counterparty}` : ""}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular">{formatMoney(remaining)}</span>{" "}
          remaining. Partial payments are fine.
        </p>
        <Field label="Amount">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAmount(String(remaining / 2))}>
            Half
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAmount(String(remaining))}>
            Settle fully
          </Button>
        </div>
        <Field label="Note">
          <Input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          Record payment
        </Button>
      </div>
    </BottomSheet>
  );
}
