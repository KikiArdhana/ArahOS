"use client";

import { create } from "zustand";

interface LockState {
  locked: boolean;
  pinRequired: boolean;
  setPinRequired: (v: boolean) => void;
  lock: () => void;
  unlock: () => void;
}

const UNLOCK_KEY = "arah:unlocked";

export const useLockStore = create<LockState>((set) => ({
  locked: false,
  pinRequired: false,
  setPinRequired: (pinRequired) =>
    set({
      pinRequired,
      locked: pinRequired && typeof window !== "undefined" && !sessionStorage.getItem(UNLOCK_KEY),
    }),
  lock: () => {
    if (typeof window !== "undefined") sessionStorage.removeItem(UNLOCK_KEY);
    set({ locked: true });
  },
  unlock: () => {
    if (typeof window !== "undefined") sessionStorage.setItem(UNLOCK_KEY, "1");
    set({ locked: false });
  },
}));
