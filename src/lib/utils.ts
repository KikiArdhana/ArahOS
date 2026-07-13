import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "IDR";
const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "id-ID";

export function formatMoney(value: number, opts: { compact?: boolean; sign?: boolean } = {}) {
  const formatter = new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
    notation: opts.compact ? "compact" : "standard",
  });
  const formatted = formatter.format(Math.abs(value));
  if (opts.sign) return `${value < 0 ? "−" : "+"}${formatted}`;
  return value < 0 ? `−${formatted}` : formatted;
}

export function formatDate(value: string | Date, style: "short" | "long" = "short") {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: style === "short" ? "short" : "long",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(d);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 4) return "Good night";
  if (h < 11) return "Good morning";
  if (h < 15) return "Good afternoon";
  if (h < 19) return "Good evening";
  return "Good night";
}

export function daysUntil(date: string) {
  const target = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function dueLabel(date: string) {
  const d = daysUntil(date);
  if (d < 0) return `Overdue ${Math.abs(d)}d`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `In ${d} days`;
}
