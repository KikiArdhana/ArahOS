"use client";

import * as React from "react";
import { CheckCircle2, Pencil, Plus, Trash2, Wrench } from "lucide-react";
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
  Textarea,
} from "@/components/ui/primitives";
import { BottomSheet, ConfirmSheet } from "@/components/ui/sheet";
import { useTable } from "@/hooks/use-table";
import { daysUntil, dueLabel, formatDate, formatMoney } from "@/lib/utils";
import type { Asset, Maintenance, MaintenanceHistory } from "@/lib/types";

type Tab = "schedule" | "history";

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "semiannual", label: "Every 6 months" },
  { value: "yearly", label: "Yearly" },
];

export default function MaintenancePage() {
  const [tab, setTab] = React.useState<Tab>("schedule");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Maintenance | null>(null);
  const [completing, setCompleting] = React.useState<Maintenance | null>(null);
  const [deleting, setDeleting] = React.useState<Maintenance | null>(null);

  const maintenance = useTable<Maintenance>("maintenance", {
    order: { column: "next_due_date", ascending: true },
  });
  const history = useTable<MaintenanceHistory>("maintenance_history", {
    order: { column: "done_at" },
  });
  const assets = useTable<Asset>("assets", { match: { status: "active" } });

  const active = maintenance.items.filter((m) => m.is_active);
  const taskName = (id: string) => maintenance.items.find((m) => m.id === id)?.name ?? "Task";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maintenance"
        subtitle="Keep your things running"
        action={
          <Button
            variant="dark"
            size="icon"
            aria-label="Add maintenance task"
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
          { value: "schedule", label: "Schedule" },
          { value: "history", label: "History" },
        ]}
      />

      {tab === "schedule" &&
        (active.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No maintenance scheduled"
            description="Oil changes, AC service, water filters — ARAH keeps track."
            action={<Button onClick={() => setSheetOpen(true)}>Add task</Button>}
          />
        ) : (
          active.map((m) => {
            const d = daysUntil(m.next_due_date);
            const asset = assets.items.find((a) => a.id === m.asset_id);
            return (
              <Card key={m.id} className="rounded-3xl p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent">
                    <Wrench className="h-5 w-5 text-accent-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset ? `${asset.name} · ` : ""}
                      {FREQUENCIES.find((f) => f.value === m.frequency)?.label} · next{" "}
                      {formatDate(m.next_due_date)}
                    </p>
                    {m.estimated_cost != null && (
                      <p className="text-xs text-muted-foreground tabular">
                        ~{formatMoney(Number(m.estimated_cost))}
                      </p>
                    )}
                  </div>
                  <Badge variant={d < 0 ? "danger" : d <= m.reminder_days ? "warning" : "default"}>
                    {dueLabel(m.next_due_date)}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => setCompleting(m)}>
                    <CheckCircle2 className="h-4 w-4" /> Done
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(m);
                      setSheetOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(m)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        ))}

      {tab === "history" &&
        (history.items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing logged yet"
            description="Completed maintenance shows up here with its cost."
          />
        ) : (
          <Card className="divide-y divide-border rounded-3xl p-0">
            {history.items.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold">{taskName(h.maintenance_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.note || "Completed"} · {formatDate(h.done_at)}
                  </p>
                </div>
                <p className="text-sm font-bold tabular">
                  {h.cost != null ? formatMoney(Number(h.cost)) : "—"}
                </p>
              </div>
            ))}
          </Card>
        ))}

      <MaintenanceSheet
        open={sheetOpen}
        task={editing}
        assets={assets.items}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSubmit={async (v) => {
          if (editing) {
            await maintenance.update.mutateAsync({ id: editing.id, ...v });
            toast.success("Task updated");
          } else {
            await maintenance.insert.mutateAsync(v);
            toast.success("Task scheduled");
          }
          setSheetOpen(false);
          setEditing(null);
        }}
      />

      <CompleteSheet
        task={completing}
        onClose={() => setCompleting(null)}
        onSubmit={async (v) => {
          await history.insert.mutateAsync(v);
          toast.success("Logged — next one scheduled");
          setCompleting(null);
        }}
      />

      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete task?"
        description="The schedule and its history will be removed permanently."
        loading={maintenance.remove.isPending}
        onConfirm={() =>
          deleting &&
          maintenance.remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Task deleted");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

function MaintenanceSheet({
  open,
  task,
  assets,
  onClose,
  onSubmit,
}: {
  open: boolean;
  task: Maintenance | null;
  assets: Asset[];
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [frequency, setFrequency] = React.useState("monthly");
  const [nextDue, setNextDue] = React.useState("");
  const [reminderDays, setReminderDays] = React.useState("7");
  const [cost, setCost] = React.useState("");
  const [assetId, setAssetId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setName(task?.name ?? "");
    setFrequency(task?.frequency ?? "monthly");
    setNextDue(task?.next_due_date ?? new Date().toISOString().slice(0, 10));
    setReminderDays(task ? String(task.reminder_days) : "7");
    setCost(task?.estimated_cost != null ? String(task.estimated_cost) : "");
    setAssetId(task?.asset_id ?? "");
  }, [task, open]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the task a name");
    if (!nextDue) return toast.error("Set the next date");
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        frequency,
        next_due_date: nextDue,
        reminder_days: Number(reminderDays) || 0,
        estimated_cost: cost ? Number(cost) : null,
        asset_id: assetId || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={task ? "Edit task" : "New maintenance task"}>
      <div className="space-y-4">
        <Field label="Task">
          <Input
            placeholder="e.g. Motor oil change"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        <Field label="Next date">
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
        <Field label="Estimated cost (optional)">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </Field>
        <Field label="Linked asset (optional)">
          <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">None</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          {task ? "Save changes" : "Schedule task"}
        </Button>
      </div>
    </BottomSheet>
  );
}

function CompleteSheet({
  task,
  onClose,
  onSubmit,
}: {
  task: Maintenance | null;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [cost, setCost] = React.useState("");
  const [note, setNote] = React.useState("");
  const [doneAt, setDoneAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setCost(task?.estimated_cost != null ? String(task.estimated_cost) : "");
    setNote("");
  }, [task]);

  const submit = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await onSubmit({
        maintenance_id: task.id,
        cost: cost ? Number(cost) : null,
        note: note || null,
        done_at: doneAt,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={Boolean(task)} onClose={onClose} title={task ? `Done · ${task.name}` : ""}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Logs this round and schedules the next one automatically.
        </p>
        <Field label="Done on">
          <Input type="date" value={doneAt} onChange={(e) => setDoneAt(e.target.value)} />
        </Field>
        <Field label="Actual cost (optional)">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </Field>
        <Field label="Note">
          <Textarea
            placeholder="Anything worth remembering?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          Log completion
        </Button>
      </div>
    </BottomSheet>
  );
}
