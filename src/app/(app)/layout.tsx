"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BottomNav, LockScreen } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Refresh due-date notifications once per session
  React.useEffect(() => {
    const key = "arah:reminders-run";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    createClient()
      .rpc("generate_due_notifications")
      .then(() => undefined);
  }, []);

  return (
    <div className="relative min-h-dvh pb-32">
      <LockScreen />
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="px-5 pt-6"
      >
        {children}
      </motion.main>
      <BottomNav />
    </div>
  );
}