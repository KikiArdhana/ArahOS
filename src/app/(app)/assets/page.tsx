"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Archive,
  Package,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
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
  Segmented,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { BottomSheet, ConfirmSheet } from "@/components/ui/sheet";
import { useTable } from "@/hooks/use-table";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { Asset, AssetCategory } from "@/lib/types";

const CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: "property", label: "Property" },
  { value: "vehicle", label: "Vehicle" },
  { value: "electronics", label: "Electronics" },
  { value: "investment", label: "Investment" },
  { value: "jewelry", label: "Jewelry" },
  { value: "other", label: "Other" },
];

type Tab = "active" | "archived";

export default function AssetsPage() {
  const [tab, setTab] = React.useState<Tab>("active");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Asset | null>(null);
  const [deleting, setDeleting] = React.useState<Asset | null>(null);

  const assets = useTable<Asset>("assets");

  const active = assets.items.filter((a) => a.status === "active");
  const archived = assets.items.filter((a) => a.status !== "active");
  const visible = tab === "active" ? active : archived;
  const total = active.reduce((s, a) => s + Number(a.value), 0);

  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    total: active.filter((a) => a.category === c.value).reduce((s, a) => s + Number(a.value), 0),
  })).filter((c) => c.total > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assets"
        subtitle="Everything you own"
        action={
          <Button
            variant="dark"
            size="icon"
            aria-label="Add asset"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-4xl bg-foreground text-background">
          <p className="text-xs font-semibold uppercase tracking-widest text-background/60">
            Asset value
          </p>
          <p className="mt-1 font-display text-3xl font-black tabular">{formatMoney(total)}</p>
          {byCategory.length > 0 && (
            <div className="mt-4 flex h-2.5 w-full gap-1 overflow-hidden rounded-full">
              {byCategory.map((c, i) => (
                <div
                  key={c.value}
                  className="h-full rounded-full"
                  style={{
                    width: `${(c.total / total) * 100}%`,
                    backgroundColor: [
                      "#D7FF2F",
                      "#9FCB1F",
                      "#6E9414",
                      "#F6F6F3",
                      "#BDBDB2",
                      "#7A7A70",
                    ][i % 6],
                  }}
                />
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {byCategory.map((c) => (
              <span key={c.value} className="text-[11px] text-background/70">
                {c.label} ·{" "}
                <span className="font-semibold tabular">
                  {formatMoney(c.total, { compact: true })}
                </span>
              </span>
            ))}
          </div>
        </Card>
      </motion.div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: `Active (${active.length})` },
          { value: "archived", label: `Archive (${archived.length})` },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={Package}
          title={tab === "active" ? "No assets yet" : "Archive is empty"}
          description={
            tab === "active"
              ? "Add your vehicle, devices, or property to track net worth."
              : "Sold or retired assets land here."
          }
          action={
            tab === "active" ? (
              <Button onClick={() => setSheetOpen(true)}>Add asset</Button>
            ) : undefined
          }
        />
      ) : (
        visible.map((a) => {
          const delta = a.purchase_value ? Number(a.value) - Number(a.purchase_value) : null;
          return (
            <Card key={a.id} className="flex items-center gap-4 rounded-3xl p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent">
                <Package className="h-5 w-5 text-accent-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  {a.status !== "active" && <Badge>{a.status}</Badge>}
                </div>
                <p className="text-xs capitalize text-muted-foreground">
                  {a.category}
                  {a.purchase_date ? ` · since ${formatDate(a.purchase_date)}` : ""}
                </p>
                <p className="mt-0.5 text-sm font-bold tabular">{formatMoney(Number(a.value))}</p>
                {delta !== null && (
                  <p
                    className={cn(
                      "mt-0.5 flex items-center gap-1 text-[11px] font-semibold",
                      delta >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {delta >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatMoney(delta, { sign: true })} since purchase
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  type="button"
                  aria-label="Edit asset"
                  onClick={() => {
                    setEditing(a);
                    setSheetOpen(true);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {a.status === "active" ? (
                  <button
                    type="button"
                    aria-label="Archive asset"
                    onClick={() =>
                      assets.update.mutate(
                        { id: a.id, status: "archived" },
                        { onSuccess: () => toast.success("Asset archived") },
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Restore asset"
                    onClick={() =>
                      assets.update.mutate(
                        { id: a.id, status: "active" },
                        { onSuccess: () => toast.success("Asset restored") },
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete asset"
                  onClick={() => setDeleting(a)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          );
        })
      )}

      <AssetSheet
        open={sheetOpen}
        asset={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSubmit={async (v) => {
          if (editing) {
            await assets.update.mutateAsync({ id: editing.id, ...v });
            toast.success("Asset updated");
          } else {
            await assets.insert.mutateAsync(v);
            toast.success("Asset added");
          }
          setSheetOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete asset?"
        description="This removes the asset permanently. Archive it instead if you might want it back."
        loading={assets.remove.isPending}
        onConfirm={() =>
          deleting &&
          assets.remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Asset deleted");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

function AssetSheet({
  open,
  asset,
  onClose,
  onSubmit,
}: {
  open: boolean;
  asset: Asset | null;
  onClose: () => void;
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<string>("other");
  const [value, setValue] = React.useState("");
  const [purchaseValue, setPurchaseValue] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setName(asset?.name ?? "");
    setCategory(asset?.category ?? "other");
    setValue(asset ? String(asset.value) : "");
    setPurchaseValue(asset?.purchase_value ? String(asset.purchase_value) : "");
    setPurchaseDate(asset?.purchase_date ?? "");
    setNote(asset?.note ?? "");
  }, [asset, open]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give the asset a name");
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        category,
        value: Number(value) || 0,
        purchase_value: purchaseValue ? Number(purchaseValue) : null,
        purchase_date: purchaseDate || null,
        note: note || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={asset ? "Edit asset" : "New asset"}>
      <div className="space-y-4">
        <Field label="Name">
          <Input
            placeholder="e.g. Honda Vario"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Current value">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="Purchase value (optional)">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={purchaseValue}
            onChange={(e) => setPurchaseValue(e.target.value)}
          />
        </Field>
        <Field label="Purchase date (optional)">
          <Input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </Field>
        <Field label="Note">
          <Textarea placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          {asset ? "Save changes" : "Add asset"}
        </Button>
      </div>
    </BottomSheet>
  );
}
