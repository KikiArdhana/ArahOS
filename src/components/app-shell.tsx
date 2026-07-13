"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import bcrypt from "bcryptjs";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Delete,
  Fingerprint,
  Home,
  Target,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";
import { useLockStore } from "@/stores/lock-store";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------- Bottom nav ------------------------------- */

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/transactions", icon: ArrowLeftRight, center: true },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex h-16 w-full max-w-app items-center rounded-full bg-card/95 shadow-float backdrop-blur-xl">
        {NAV.map(({ href, label, icon: Icon, center }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center py-2"
            >
              <motion.div
                animate={{ y: active ? -4 : 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
                className="flex flex-col items-center gap-1"
              >
                {center ? (
                  /* Center item — transaction logo in a filled circle */
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200",
                      active ? "bg-primary text-primary-foreground" : "bg-foreground text-background",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                ) : (
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors duration-200",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "text-[11px] leading-none transition-colors duration-200",
                    active ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </motion.div>

              {/* Green underline — slides between tabs */}
              {active && (
                <motion.span
                  layoutId="nav-underline"
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  className="absolute bottom-1.5 h-[3px] w-7 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* -------------------------------- Page header ------------------------------ */

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {back && (
          <button
            type="button"
            aria-label="Go back"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-card"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

/* --------------------------------- PIN pad --------------------------------- */

export type PinStatus = "idle" | "verifying" | "success" | "error";

export function PinPad({
  onComplete,
  length = 6,
  statusText = "Checking…",
}: {
  onComplete: (pin: string) => void | Promise<void>;
  length?: number;
  statusText?: string;
}) {
  const [pin, setPin] = React.useState("");
  const [status, setStatus] = React.useState<PinStatus>("idle");

  const press = (d: string) => {
    if (status !== "idle" || pin.length >= length) return;
    const next = pin + d;
    setPin(next);
    if (next.length === length) {
      setStatus("verifying");
      Promise.resolve(onComplete(next))
        .catch(() => undefined)
        .finally(() => {
          setPin("");
          setStatus("idle");
        });
    }
  };

  const busy = status !== "idle";

  return (
    <div className="w-full">
      {/* Dots — pulse in a wave while verifying */}
      <div className="mb-3 flex justify-center gap-3">
        {Array.from({ length }).map((_, i) => (
          <motion.span
            key={i}
            animate={
              status === "verifying"
                ? { scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }
                : { scale: i === pin.length - 1 ? [1, 1.3, 1] : 1 }
            }
            transition={
              status === "verifying"
                ? { repeat: Infinity, duration: 0.9, delay: i * 0.1, ease: "easeInOut" }
                : undefined
            }
            className={cn(
              "h-3.5 w-3.5 rounded-full transition-colors",
              status === "verifying" || i < pin.length ? "bg-primary" : "bg-secondary",
            )}
          />
        ))}
      </div>

      {/* Status text — keeps layout height stable */}
      <div className="mb-5 h-4 text-center">
        <AnimatePresence>
          {status === "verifying" && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs font-semibold text-muted-foreground"
            >
              {statusText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Keypad — locked while verifying */}
      <div
        className={cn(
          "mx-auto grid max-w-[280px] grid-cols-3 gap-3 transition-opacity duration-200",
          busy && "pointer-events-none opacity-40",
        )}
      >
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            disabled={busy}
            onClick={() => press(d)}
            className="h-16 rounded-3xl bg-card font-display text-xl font-bold shadow-card transition-transform active:scale-95"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          aria-label="Biometric unlock"
          onClick={() => toast.info("Biometric unlock is coming soon")}
          className="flex h-16 items-center justify-center rounded-3xl text-muted-foreground"
        >
          <Fingerprint className="h-6 w-6" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => press("0")}
          className="h-16 rounded-3xl bg-card font-display text-xl font-bold shadow-card transition-transform active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label="Delete digit"
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="flex h-16 items-center justify-center rounded-3xl text-muted-foreground"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- Lock screen ------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LockScreen() {
  const { profile } = useProfile();
  const { locked, pinRequired, setPinRequired, unlock } = useLockStore();
  const [unlocked, setUnlocked] = React.useState(false); // success flash

  React.useEffect(() => {
    if (profile) setPinRequired(Boolean(profile.pin_hash));
  }, [profile, setPinRequired]);

  const verify = async (pin: string) => {
    if (!profile?.pin_hash) return;
    // Minimum 700ms so the checking animation is visible
    const [ok] = await Promise.all([bcrypt.compare(pin, profile.pin_hash), sleep(700)]);
    if (ok) {
      setUnlocked(true); // show the green check
      await sleep(650);
      unlock();
      setUnlocked(false);
    } else {
      toast.error("Wrong PIN — try again");
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(120);
    }
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.href = "/login";
  };

  return (
    <AnimatePresence>
      {pinRequired && locked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background px-6"
        >
          {unlocked ? (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 14 }}
              className="flex flex-col items-center gap-3"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-float">
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: "spring", damping: 12 }}
                >
                  <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
                </motion.span>
              </span>
              <p className="font-display text-lg font-bold">Welcome back</p>
            </motion.div>
          ) : (
            <>
              <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary shadow-card">
                <span className="font-display text-2xl font-black">A</span>
              </div>
              <h2 className="font-display text-xl font-bold">
                Hi, {profile?.display_name?.split(" ")[0]}
              </h2>
              <p className="mb-8 text-sm text-muted-foreground">Enter your PIN to unlock</p>
              <PinPad onComplete={verify} statusText="Checking your PIN…" />
              <button
                type="button"
                onClick={signOut}
                className="mt-8 text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline"
              >
                Sign out instead
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}