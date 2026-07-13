"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Landmark, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Segmented,
  Select,
} from "@/components/ui/primitives";
import { BottomSheet, ConfirmSheet } from "@/components/ui/sheet";
import { useTable } from "@/hooks/use-table";
import { cn, daysUntil, dueLabel, formatDate, formatMoney } from "@/lib/utils";
import type { Account, Bill, BillPayment } from "@/lib/types";

type Tab = "upcoming" | "calendar" | "history";

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function BillsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<Tab>("upcoming");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Bill | null>(null);
  const [paying, setPaying] = React.useState<Bill | null>(null);
  const [deleting, setDeleting] = React.useState<Bill | null>(null);

  const bills = useTable<Bill>("bills", { order: { column: "next_due_date", ascending: true } });
  const payments = useTable<BillPayment>("bill_payments", { order: { column: "occurred_at" } });
  const accounts = useTable<Account>("accounts", { match: { is_archived: false } });

  React.useEffect(() => {
    if (params.get("new")) {
      setSheetOpen(true);
      router.replace("/bills");
    }
  }, [params, router]);

  const activeBills = bills.items.filter((b) => b.is_active);
  const monthTotal = activeBills
    .filter((b) => b.frequency === "monthly")
    .reduce((s, b) => s + Number(b.amount), 0);

  const billName = (id: string) => bills.items.find((b) => b.id === id)?.name ?? "Bill";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bills"
        subtitle={`${formatMoney(monthTotal)} in monthly bills`}
        action={
          <Button
            variant="dark"
            size="icon"
            aria-label="Add bill"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "upcoming", label: "Upcoming" },
          { value: "calendar", label: "Calendar" },
          { value: "history", label: "History" },
        ]}
      />

      {tab === "upcoming" &&
        (activeBills.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No recurring bills"
            description="Add internet, rent, or subscriptions and ARAH will remind you."
            action={<Button onClick={() => setSheetOpen(true)}>Add bill</Button>}
          />
        ) : (
          activeBills.map((b) => {
            const d = daysUntil(b.next_due_date);
            return (
              <Card key={b.id} className="rounded-3xl p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent">
                    <Receipt className="h-5 w-5 text-accent-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{b.name}</p>
                      {b.auto_pay && <Badge>Auto</Badge>}
                    </div>
                    <p className="text-xs capitalize text-muted-foreground">
                      {b.frequency} · next {formatDate(b.next_due_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular">{formatMoney(Number(b.amount))}</p>
                    <Badge
                      variant={d < 0 ? "danger" : d <= b.reminder_days ? "warning" : "default"}
                    >
                      {dueLabel(b.next_due_date)}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => setPaying(b)}>
                    Mark paid
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(b);
                      setSheetOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(b)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        ))}

      {tab === "calendar" && <BillCalendar bills={activeBills} />}

      {tab === "history" &&
        (payments.items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments yet"
            description="Every bill you mark as paid appears here."
          />
        ) : (
          <Card className="divide-y divide-border rounded-3xl p-0">
            {payments.items.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold">{billName(p.bill_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    For {formatDate(p.paid_for_date)} · paid {formatDate(p.occurred_at)}
                  </p>
                </div>
                <p className="text-sm font-bold tabular">{formatMoney(Number(p.amount))}</p>
              </div>
            ))}
          </Card>
        ))}

      <BillSheet
        open={sheetOpen}
        bill={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSubmit={async (v) => {
          if (editing) {
            await bills.update.mutateAsync({ id: editing.id, ...v });
            toast.success("Bill updated");
          } else {
            await bills.insert.mutateAsync(v);
            toast.success("Bill added");
          }
          setSheetOpen(false);
          setEditing(null);
        }}
      />

      <PayBillSheet
        bill={paying}
        accounts={accounts.items}
        onClose={() => setPaying(null)}
        onSubmit={async (v) => {
          await payments.insert.mutateAsync(v);
          toast.success("Bill paid — due date rolled forward");
          setPaying(null);
        }}
      />

      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete bill?"
        description="The bill and its payment history will be removed permanently."
        loading={bills.remove.isPending}
        onConfirm={() =>
          deleting &&
          bills.remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Bill deleted");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

function BillCalendar({ bills }: { bills: Bill[] }) {
  const [offset, setOffset] = React.useState(0);
  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDow = (month.getDay() + 6) % 7; // Monday first

  const dueByDay = new Map<number, Bill[]>();
  for (const b of bills) {
    const d = new Date(b.next_due_date + "T00:00:00");
    if (d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()) {
      const list = dueByDay.get(d.getDate()) ?? [];
      list.push(b);
      dueByDay.set(d.getDate(), list);
    }
  }

  const today = new Date();
  const isThisMonth =
    today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();

  return (
    <Card className="rounded-4xl">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          className="h-9 w-9 rounded-full bg-secondary font-bold"
        >
          ‹
        </button>
        <p className="font-display font-bold">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="h-9 w-9 rounded-full bg-secondary font-bold"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const due = dueByDay.get(day);
          const isToday = isThisMonth && today.getDate() === day;
          return (
            <div
              key={day}
              className={cn(
                "relative flex h-10 flex-col items-center justify-center rounded-2xl text-xs font-semibold",
                isToday && "bg-foreground text-background",
                due && !isToday && "bg-accent",
              )}
            >
              {day}
              {due && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-ring" />}
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2">
        {[...dueByDay.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([day, list]) =>
            list.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  <span className="mr-2 inline-block w-6 text-right font-bold tabular">{day}</span>
                  {b.name}
                </span>
                <span className="font-bold tabular">{formatMoney(Number(b.amount))}</span>
              </div>
            )),
          )}
        {dueByDay.size === 0 && (
          <p className="text-center text-sm text-muted-foreground">No bills due this month.</p>
        )}
      </div>
    </Card>
  );
}

function BillSheet({
  open,
  bill,
  onClose,
  onSubmit,
}: {
  open: boolean;
  bill: Bill | null;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [frequency, setFrequency] = React.useState("monthly");
  const [nextDue, setNextDue] = React.useState("");
  const [reminderDays, setReminderDays] = React.useState("3");
  const [autoPay, setAutoPay] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setName(bill?.name ?? "");
    setAmount(bill ? String(bill.amount) : "");
    setFrequency(bill?.frequency ?? "monthly");
    setNextDue(bill?.next_due_date ?? new Date().toISOString().slice(0, 10));
    setReminderDays(bill ? String(bill.reminder_days) : "3");
    setAutoPay(bill?.auto_pay ?? false);
  }, [bill, open]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the bill a name");
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount greater than zero");
    if (!nextDue) return toast.error("Set the next due date");
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        amount: value,
        frequency,
        next_due_date: nextDue,
        reminder_days: Number(reminderDays) || 0,
        auto_pay: autoPay,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={bill ? "Edit bill" : "New bill"}>
      <div className="space-y-4">
        <Field label="Name">
          <Input
            placeholder="e.g. Internet"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        <Field label="Repeats">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next due date">
          <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        </Field>
        <Field label="Remind me (days before)">
          <Input
            type="number"
            min={0}
            value={reminderDays}
            onChange={(e) => setReminderDays(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#D7FF2F]"
            checked={autoPay}
            onChange={(e) => setAutoPay(e.target.checked)}
          />
          Paid automatically
        </label>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          {bill ? "Save changes" : "Add bill"}
        </Button>
      </div>
    </BottomSheet>
  );
}

function PayBillSheet({
  bill,
  accounts,
  onClose,
  onSubmit,
}: {
  bill: Bill | null;
  accounts: Account[];
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setAmount(bill ? String(bill.amount) : "");
  }, [bill]);

  const submit = async () => {
    if (!bill) return;
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount greater than zero");
    setBusy(true);
    try {
      await onSubmit({
        bill_id: bill.id,
        amount: value,
        account_id: accountId || null,
        paid_for_date: bill.next_due_date,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={Boolean(bill)} onClose={onClose} title={bill ? `Pay · ${bill.name}` : ""}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Marks the {bill && formatDate(bill.next_due_date)} bill as paid and schedules the next
          one.
        </p>
        <Field label="Amount paid">
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="From account (optional)">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Not linked</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          Mark as paid
        </Button>
      </div>
    </BottomSheet>
  );
}

export default function BillsPage() {
  return (
    <React.Suspense>
      <BillsContent />
    </React.Suspense>
  );
}
