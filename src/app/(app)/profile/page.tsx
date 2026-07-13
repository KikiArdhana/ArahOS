"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import bcrypt from "bcryptjs";
import {
  AlertTriangle,
  ChevronRight,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Moon,
  Pencil,
  ShieldCheck,
  Sun,
  SunMoon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PinPad } from "@/components/app-shell";
import { Button, Card, Field, Input, Segmented } from "@/components/ui/primitives";
import { BottomSheet, ConfirmSheet } from "@/components/ui/sheet";
import { useProfile } from "@/hooks/use-profile";
import { useLockStore } from "@/stores/lock-store";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, update } = useProfile();
  const { lock } = useLockStore();

  const [email, setEmail] = React.useState<string>("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [wipeOpen, setWipeOpen] = React.useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, [supabase]);

  const theme = profile?.theme ?? "system";

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Profile" subtitle="Your account and security" />

      {/* Identity */}
      <Card className="flex items-center gap-4 rounded-4xl">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground text-background">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-xl font-black">
              {(profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{profile?.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{profile?.username ?? "no-username"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Mail className="h-3 w-3" /> {email}
          </p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Edit profile"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </Card>

      {/* Appearance */}
      <section>
        <h2 className="mb-2 px-1 font-display text-sm font-bold">Appearance</h2>
        <Card className="rounded-3xl">
          <Segmented
            value={theme}
            onChange={(v) => update.mutate({ theme: v })}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            {theme === "light" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : theme === "dark" ? (
              <Moon className="h-3.5 w-3.5" />
            ) : (
              <SunMoon className="h-3.5 w-3.5" />
            )}
            {theme === "system" ? "Follows your device setting" : `Always ${theme}`}
          </p>
        </Card>
      </section>

      {/* Security */}
      <section>
        <h2 className="mb-2 px-1 font-display text-sm font-bold">Security</h2>
        <Card className="divide-y divide-border rounded-3xl p-0">
          <SettingRow
            icon={Lock}
            title={profile?.pin_hash ? "Change PIN" : "Create PIN"}
            subtitle={profile?.pin_hash ? "6-digit lock is on" : "Lock the app with a 6-digit PIN"}
            onClick={() => setPinOpen(true)}
          />
          {profile?.pin_hash && (
            <>
              <SettingRow
                icon={ShieldCheck}
                title="Lock now"
                subtitle="Require PIN immediately"
                onClick={() => {
                  lock();
                  toast.success("Locked");
                }}
              />
              <SettingRow
                icon={Lock}
                title="Remove PIN"
                subtitle="Turn off the lock screen"
                onClick={() =>
                  update.mutate(
                    { pin_hash: null },
                    { onSuccess: () => toast.success("PIN removed") },
                  )
                }
              />
            </>
          )}
          <SettingRow
            icon={Fingerprint}
            title="Biometric unlock"
            subtitle={
              profile?.biometric_enabled ? "Enabled (device support coming soon)" : "Coming soon"
            }
            onClick={() =>
              update.mutate(
                { biometric_enabled: !profile?.biometric_enabled },
                {
                  onSuccess: () =>
                    toast.info(
                      profile?.biometric_enabled
                        ? "Biometric placeholder disabled"
                        : "Biometric placeholder enabled — device support coming soon",
                    ),
                },
              )
            }
          />
          <SettingRow
            icon={KeyRound}
            title="Change password"
            subtitle="Update your sign-in password"
            onClick={() => setPasswordOpen(true)}
          />
        </Card>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="mb-2 px-1 font-display text-sm font-bold text-destructive">Danger zone</h2>
        <Card className="rounded-2xl border border-destructive/20 p-0">
          <SettingRow
            icon={Trash2}
            title="Erase all data"
            subtitle="Delete every pocket, transaction, goal, and record"
            onClick={() => setWipeOpen(true)}
            danger
          />
        </Card>
      </section>

      <Button
        variant="destructive"
        size="lg"
        className="w-full"
        onClick={() => setSignOutOpen(true)}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <p className="pb-4 text-center text-[11px] text-muted-foreground">
        ARAH · Your Personal Life Operating System
      </p>

      {/* Edit profile */}
      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={{
          display_name: profile?.display_name ?? "",
          username: profile?.username ?? "",
          avatar_url: profile?.avatar_url ?? "",
        }}
        onSubmit={async (v) => {
          await update.mutateAsync(v);
          toast.success("Profile updated");
          setEditOpen(false);
        }}
      />

      {/* PIN */}
      <BottomSheet open={pinOpen} onClose={() => setPinOpen(false)} title="Set your PIN">
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Choose 6 digits. You&apos;ll need them every time you open ARAH.
        </p>
        <PinPad
          onComplete={async (pin) => {
            const hash = await bcrypt.hash(pin, 10);
            update.mutate(
              { pin_hash: hash },
              {
                onSuccess: () => {
                  toast.success("PIN saved");
                  setPinOpen(false);
                },
              },
            );
          }}
        />
      </BottomSheet>

      {/* Password */}
      <ChangePasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />

      {/* Erase all data */}
      <EraseDataSheet open={wipeOpen} onClose={() => setWipeOpen(false)} />

      <ConfirmSheet
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={signOut}
        title="Sign out?"
        description="You'll need your email and password to get back in."
        confirmLabel="Sign out"
      />
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
    >
      <span
        className={
          danger
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-destructive dark:bg-red-900/40"
            : "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"
        }
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={
            danger ? "block text-sm font-semibold text-destructive" : "block text-sm font-semibold"
          }
        >
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/* ------------------------------ Erase all data ------------------------------ */

const CONFIRM_WORD = "DELETE";

/** Children first, then parents — cascades handle the rest either way. */
const WIPE_TABLES = [
  "goal_contributions",
  "debt_payments",
  "bill_payments",
  "maintenance_history",
  "transactions",
  "transfers",
  "allocations",
  "goals",
  "debts",
  "bills",
  "maintenance",
  "assets",
  "notifications",
  "accounts",
];

function EraseDataSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [word, setWord] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) setWord("");
  }, [open]);

  const matches = word === CONFIRM_WORD;

  const wipe = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      for (const table of WIPE_TABLES) {
        const { error } = await supabase.from(table).delete().eq("user_id", user.id);
        if (error) throw new Error(`${table}: ${error.message}`);
      }

      queryClient.invalidateQueries();
      toast.success("All data erased — fresh start");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Erase all data">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-3 dark:bg-red-950/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs leading-relaxed text-destructive">
            This permanently deletes <span className="font-bold">everything</span>: all pockets,
            transactions, transfers, goals, assets, debts, bills, maintenance records, and
            notifications. Your account, profile, and PIN stay. This cannot be undone.
          </p>
        </div>

        <Field label={`Type ${CONFIRM_WORD} to confirm`}>
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={matches ? "border-destructive ring-1 ring-destructive/40" : ""}
          />
        </Field>

        <div className="flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="flex-1"
            disabled={!matches}
            loading={busy}
            onClick={wipe}
          >
            Erase everything
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function EditProfileSheet({
  open,
  onClose,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial: { display_name: string; username: string; avatar_url: string };
  onSubmit: (v: Record<string, unknown>) => Promise<void>;
}) {
  const [displayName, setDisplayName] = React.useState(initial.display_name);
  const [username, setUsername] = React.useState(initial.username);
  const [avatarUrl, setAvatarUrl] = React.useState(initial.avatar_url);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setDisplayName(initial.display_name);
    setUsername(initial.username);
    setAvatarUrl(initial.avatar_url);
  }, [initial.display_name, initial.username, initial.avatar_url, open]);

  const submit = async () => {
    if (!displayName.trim()) return toast.error("Display name can't be empty");
    setBusy(true);
    try {
      await onSubmit({
        display_name: displayName.trim(),
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit profile">
      <div className="space-y-4">
        <Field label="Display name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Username">
          <Input
            value={username}
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Avatar URL">
          <Input
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          Save changes
        </Button>
      </div>
    </BottomSheet>
  );
}

function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = createClient();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (password.length < 8) return toast.error("Use at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPassword("");
    setConfirm("");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Change password">
      <div className="space-y-4">
        <Field label="New password">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          Update password
        </Button>
      </div>
    </BottomSheet>
  );
}