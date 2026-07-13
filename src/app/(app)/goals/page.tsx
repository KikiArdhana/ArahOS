"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  History,
  ImagePlus,
  PartyPopper,
  Pencil,
  Plus,
  Smile,
  Target,
  Trash2,
  Undo2,
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
} from "@/components/ui/primitives";
import { BottomSheet, ConfirmSheet } from "@/components/ui/sheet";
import { useTable } from "@/hooks/use-table";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { Account, Goal, GoalContribution } from "@/lib/types";

type Tab = "active" | "completed" | "archived";

/* ------------------------------ Icon rendering ------------------------------ */

function isImageIcon(icon: string | null | undefined) {
  return Boolean(icon && icon.startsWith("data:image"));
}

function isEmojiIcon(icon: string | null | undefined) {
  return Boolean(icon && !isImageIcon(icon) && icon.length <= 16 && icon !== "target");
}

function GoalIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  if (isImageIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={icon!} alt="" className={cn("h-full w-full rounded-2xl object-cover", className)} />
    );
  }
  if (isEmojiIcon(icon)) {
    return <span className={cn("text-2xl leading-none", className)}>{icon}</span>;
  }
  return <Target className={cn("h-5 w-5 text-accent-foreground", className)} />;
}

/** Keep only the first emoji/character cluster the user typed. */
function firstGrapheme(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const first = seg.segment(trimmed)[Symbol.iterator]().next();
    return first.done ? "" : first.value.segment;
  }
  return Array.from(trimmed)[0] ?? "";
}

/** Resize an uploaded image to a small square data URL so it fits in the icon column. */
function fileToIconDataUrl(file: File, size = 96): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      const side = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };
    img.src = url;
  });
}

/* ------------------------------- Icon picker -------------------------------- */

type IconMode = "emoji" | "image";

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mode, setMode] = React.useState<IconMode>(isImageIcon(value) ? "image" : "emoji");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMode(isImageIcon(value) ? "image" : "emoji");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    try {
      onChange(await fileToIconDataUrl(file));
    } catch {
      toast.error("Couldn't read that image");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent">
          <GoalIcon icon={value} className={isEmojiIcon(value) ? "text-3xl" : undefined} />
        </span>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            onChange("");
          }}
          options={[
            { value: "emoji", label: "Emoji" },
            { value: "image", label: "Upload" },
          ]}
          className="flex-1"
        />
      </div>

      {mode === "emoji" ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Smile className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={isEmojiIcon(value) ? value : ""}
              onChange={(e) => onChange(firstGrapheme(e.target.value))}
              placeholder="Type an emoji from your keyboard…"
              className="pl-10 text-lg"
              autoComplete="off"
            />
          </div>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card text-sm font-semibold shadow-card"
          >
            <ImagePlus className="h-4 w-4" />
            {isImageIcon(value) ? "Change image" : "Upload from gallery"}
          </button>
          {isImageIcon(value) && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
            >
              Reset
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {mode === "emoji"
          ? "On Windows press Win + . (period) · on phones use the emoji keyboard."
          : "Photos are cropped square and stored as a small logo."}
      </p>
    </div>
  );
}

/* -------------------------------- Celebration ------------------------------- */

function Celebration({ show }: { show: boolean }) {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 320,
        rotate: Math.random() * 360,
        delay: Math.random() * 0.2,
        color: ["#D7FF2F", "#10120C", "#8AB800", "#FFFFFF"][i % 4],
      })),
    [],
  );
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[70] flex items-start justify-center overflow-hidden"
        >
          {pieces.map((p) => (
            <motion.span
              key={p.id}
              initial={{ y: -20, x: p.x, rotate: 0, opacity: 1 }}
              animate={{ y: "105vh", rotate: p.rotate + 720, opacity: [1, 1, 0.6] }}
              transition={{ duration: 2.2, delay: p.delay, ease: "easeIn" }}
              className="absolute top-0 h-3 w-2 rounded-sm"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------- Page ------------------------------------ */

function GoalsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<Tab>("active");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = React.useState<Goal | null>(null);
  const [historyGoal, setHistoryGoal] = React.useState<Goal | null>(null);
  const [deleteGoal, setDeleteGoal] = React.useState<Goal | null>(null);
  const [celebrate, setCelebrate] = React.useState(false);

  const goals = useTable<Goal>("goals");
  const accounts = useTable<Account>("accounts", { match: { is_archived: false } });
  const contributions = useTable<GoalContribution>("goal_contributions", {
    order: { column: "occurred_at" },
  });

  React.useEffect(() => {
    if (params.get("new")) {
      setEditing(null);
      setFormOpen(true);
      router.replace("/goals");
    }
  }, [params, router]);

  const visible = goals.items.filter((g) => g.status === tab);

  const fireCelebration = () => {
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 2600);
  };

  return (
    <div className="space-y-5">
      <Celebration show={celebrate} />
      <PageHeader
        title="Goals"
        subtitle="Save toward what matters"
        action={
          <Button
            variant="dark"
            size="icon"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            aria-label="New goal"
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: "Active" },
          { value: "completed", label: "Done" },
          { value: "archived", label: "Archived" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={Target}
          title={tab === "active" ? "No goals yet" : `Nothing ${tab}`}
          description={
            tab === "active"
              ? "Create a goal and start contributing toward it."
              : "Goals you finish or park will show up here."
          }
          action={
            tab === "active" ? (
              <Button onClick={() => setFormOpen(true)}>Create goal</Button>
            ) : undefined
          }
        />
      ) : (
        visible.map((g) => {
          const pct = Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100);
          return (
            <motion.div
              key={g.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
             <Card className="rounded-2xl border border-gray-400 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent">
                      {g.status === "completed" && !g.icon ? (
                        <PartyPopper className="h-5 w-5 text-accent-foreground" />
                      ) : (
                        <GoalIcon icon={g.icon} />
                      )}
                    </span>
                    <div>
                      <p className="font-semibold">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.deadline ? `Target ${formatDate(g.deadline)}` : "No deadline"}
                      </p>
                    </div>
                  </div>
                  {g.status === "completed" && <Badge variant="primary">Reached</Badge>}
                </div>

                <Progress value={pct} className="mt-4 h-2.5" />
                <div className="mt-2 flex items-baseline justify-between">
                  <p className="text-sm font-bold tabular">
                    {formatMoney(Number(g.current_amount))}
                    <span className="font-medium text-muted-foreground">
                      {" "}
                      / {formatMoney(Number(g.target_amount))}
                    </span>
                  </p>
                  <p className="text-xs font-bold tabular">{Math.round(pct)}%</p>
                </div>

                {/* Compact actions: Add · edit · history · delete */}
                <div className="mt-4 flex items-center gap-2">
                  {g.status === "active" && (
                    <Button size="sm" onClick={() => setContributeGoal(g)}>
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  )}
                  <IconAction
                    label="Edit goal"
                    onClick={() => {
                      setEditing(g);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </IconAction>
                  <IconAction label="Contribution history" onClick={() => setHistoryGoal(g)}>
                    <History className="h-4 w-4" />
                  </IconAction>
                  <IconAction label="Delete goal" danger onClick={() => setDeleteGoal(g)}>
                    <Trash2 className="h-4 w-4" />
                  </IconAction>
                </div>
              </Card>
            </motion.div>
          );
        })
      )}

      {/* Create / Edit goal */}
      <GoalFormSheet
        open={formOpen}
        goal={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onArchiveToggle={
          editing
            ? () => {
                const toArchived = editing.status !== "archived";
                goals.update.mutate(
                  { id: editing.id, status: toArchived ? "archived" : "active" },
                  {
                    onSuccess: () => {
                      toast.success(toArchived ? "Goal archived" : "Goal restored");
                      setFormOpen(false);
                      setEditing(null);
                    },
                  },
                );
              }
            : undefined
        }
        onSubmit={async (v) => {
          if (editing) {
            await goals.update.mutateAsync({ id: editing.id, ...v });
            toast.success("Goal updated");
          } else {
            await goals.insert.mutateAsync(v);
            toast.success("Goal created");
          }
          setFormOpen(false);
          setEditing(null);
        }}
      />

      {/* Contribute */}
      <ContributeSheet
        goal={contributeGoal}
        accounts={accounts.items}
        onClose={() => setContributeGoal(null)}
        onSubmit={async (v) => {
          const goal = contributeGoal!;
          await contributions.insert.mutateAsync(v);
          const willComplete =
            Number(goal.current_amount) + Number(v.amount) >= Number(goal.target_amount);
          if (willComplete) {
            toast.success(`Goal reached: ${goal.name} 🎉`);
            fireCelebration();
          } else {
            toast.success("Contribution added");
          }
          setContributeGoal(null);
        }}
      />

      {/* History */}
      <BottomSheet
        open={Boolean(historyGoal)}
        onClose={() => setHistoryGoal(null)}
        title={historyGoal ? `${historyGoal.name} · history` : "History"}
      >
        {(() => {
          const rows = contributions.items.filter((c) => c.goal_id === historyGoal?.id);
          if (rows.length === 0)
            return (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No contributions yet.
              </p>
            );
          return (
            <div className="divide-y divide-border">
              {rows.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold tabular">
                      +{formatMoney(Number(c.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.note || "Contribution"} · {formatDate(c.occurred_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete contribution"
                    onClick={() =>
                      contributions.remove.mutate(c.id, {
                        onSuccess: () => toast.success("Contribution removed"),
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
        open={Boolean(deleteGoal)}
        onClose={() => setDeleteGoal(null)}
        title="Delete goal?"
        description="The goal and all its contribution history will be removed permanently."
        loading={goals.remove.isPending}
        onConfirm={() =>
          deleteGoal &&
          goals.remove.mutate(deleteGoal.id, {
            onSuccess: () => {
              toast.success("Goal deleted");
              setDeleteGoal(null);
            },
          })
        }
      />
    </div>
  );
}

/* ------------------------------ Small components ---------------------------- */

function IconAction({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-card transition-transform active:scale-90",
        danger ? "text-destructive" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Create / Edit ------------------------------- */

function GoalFormSheet({
  open,
  goal,
  onClose,
  onSubmit,
  onArchiveToggle,
}: {
  open: boolean;
  goal: Goal | null;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
  onArchiveToggle?: () => void;
}) {
  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setName(goal?.name ?? "");
    setIcon(goal?.icon && goal.icon !== "target" ? goal.icon : "");
    setTarget(goal ? String(goal.target_amount) : "");
    setDeadline(goal?.deadline ?? "");
  }, [goal, open]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the goal a name");
    const t = Number(target);
    if (!t || t <= 0) return toast.error("Set a target amount");
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        icon: icon || "target",
        target_amount: t,
        deadline: deadline || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={goal ? "Edit goal" : "New goal"}>
      <div className="space-y-4">
        <Field label="Logo">
          <IconPicker key={`${goal?.id ?? "new"}-${open}`} value={icon} onChange={setIcon} />
        </Field>
        <Field label="Name">
          <Input
            placeholder="e.g. Emergency fund"
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
        <Field label="Deadline (optional)">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          {goal ? "Save changes" : "Create goal"}
        </Button>
        {goal && onArchiveToggle && (
          <Button variant="secondary" size="lg" className="w-full" onClick={onArchiveToggle}>
            {goal.status === "archived" ? (
              <>
                <Undo2 className="h-4 w-4" /> Restore goal
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" /> Archive goal
              </>
            )}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}

/* --------------------------------- Contribute ------------------------------- */

function ContributeSheet({
  goal,
  accounts,
  onClose,
  onSubmit,
}: {
  goal: Goal | null;
  accounts: Account[];
  onClose: () => void;
  onSubmit: (v: {
    goal_id: string;
    amount: number;
    account_id: string | null;
    note: string | null;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const remaining = goal ? Number(goal.target_amount) - Number(goal.current_amount) : 0;

  const submit = async () => {
    if (!goal) return;
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount greater than zero");
    setBusy(true);
    try {
      await onSubmit({
        goal_id: goal.id,
        amount: value,
        account_id: accountId || null,
        note: note || null,
      });
      setAmount("");
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={Boolean(goal)}
      onClose={onClose}
      title={goal ? `Contribute · ${goal.name}` : ""}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular">{formatMoney(remaining)}</span> to
          go.
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
        <Field label="Note">
          <Input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          Add contribution
        </Button>
      </div>
    </BottomSheet>
  );
}

export default function GoalsPage() {
  return (
    <React.Suspense>
      <GoalsContent />
    </React.Suspense>
  );
}