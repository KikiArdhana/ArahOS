"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function SplashPage() {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    const timer = setTimeout(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      router.replace(user ? "/home" : "/login");
    }, 1400);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <motion.div
        initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 14 }}
        className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary shadow-float"
      >
        <span className="font-display text-4xl font-black tracking-tight text-primary-foreground">
          A
        </span>
      </motion.div>
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <h1 className="font-display text-3xl font-black tracking-tight">ARAH</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your Personal Life Operating System</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-12 h-1 w-16 overflow-hidden rounded-full bg-secondary"
      >
        <motion.div
          className="h-full w-1/2 rounded-full bg-primary"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
        />
      </motion.div>
    </main>
  );
}
