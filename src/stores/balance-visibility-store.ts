"use client";

import { create } from "zustand";

interface BalanceVisibilityState {
  hidden: boolean;
  toggle: () => void;
}

const HIDDEN_KEY = "arah:balance-hidden";

export const useBalanceVisibilityStore = create<BalanceVisibilityState>((set, get) => ({
  hidden: typeof window !== "undefined" && localStorage.getItem(HIDDEN_KEY) === "1",
  toggle: () => {
    const hidden = !get().hidden;
    if (typeof window !== "undefined") localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0");
    set({ hidden });
  },
}));
