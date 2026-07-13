"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import bcrypt from "bcryptjs";
import { toast } from "sonner";
import { PinPad } from "@/components/app-shell";
import { useProfile } from "@/hooks/use-profile";
import { useLockStore } from "@/stores/lock-store";

export default function CreatePinPage() {
  const router = useRouter();
  const { update } = useProfile();
  const { unlock } = useLockStore();
  const [first, setFirst] = React.useState<string | null>(null);

  const handle = async (pin: string) => {
    if (!first) {
      setFirst(pin);
      return;
    }
    if (pin !== first) {
      toast.error("PINs don't match — start over");
      setFirst(null);
      return;
    }
    const hash = await bcrypt.hash(pin, 10);
    update.mutate(
      { pin_hash: hash },
      {
        onSuccess: () => {
          unlock();
          toast.success("PIN set — welcome to ARAH");
          router.replace("/home");
        },
      },
    );
  };

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center">
      <motion.div
        key={first ? "confirm" : "create"}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h1 className="font-display text-2xl font-black tracking-tight">
          {first ? "Confirm your PIN" : "Create a PIN"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {first ? "Enter the same 6 digits again." : "6 digits to keep ARAH private."}
        </p>
      </motion.div>
      <PinPad onComplete={handle} />
      <button
        type="button"
        onClick={() => router.replace("/home")}
        className="mt-8 text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline"
      >
        Skip for now
      </button>
    </div>
  );
}
