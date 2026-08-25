# ARAH

### Your Personal Life Operating System

ARAH is a premium, mobile-first personal management app designed to bring **money, goals, assets, debts, bills, maintenance, and reminders** into one place.

Instead of managing different parts of your life across multiple apps and spreadsheets, ARAH gives you a single personal dashboard to keep everything organized.

> **Built for one person. Built around your life.**

---

## ✨ Overview

ARAH focuses on giving users a clear picture of their personal life and finances through a simple, modern interface.

The application combines:

- 💰 Personal finance
- 🎯 Goals & savings
- 💎 Assets & net worth
- 💳 Debts & repayments
- 🧾 Recurring bills
- 🔧 Maintenance schedules
- 🔔 Notifications & reminders
- 👤 Personal profile & security

The goal is not to be another complicated finance dashboard, but a **personal operating system** that helps you keep track of the things that matter.

---

## 📱 Main Features

### 🏠 Home

A centralized overview of your current situation.

- Greeting & live clock
- Net worth overview
- Monthly income & expenses
- Quick statistics
- Goals, bills & maintenance previews
- Recent activity
- Notification indicator
- Quick-action menu
- Floating navigation

---

### 💰 Money

Manage your everyday finances in one place.

- Multiple accounts
- Income & expense tracking
- Search & filters
- Transfers
- Allocations
- Automatic balance synchronization

Account balances are kept consistent through database-level triggers.

---

### 🎯 Goals

Turn plans into measurable targets.

- Create financial goals
- Set target amounts
- Track contributions
- View progress
- Contribution history
- Archive completed goals
- Automatic completion
- Celebration animation 🎉

---

### 💎 Assets

Keep track of what you own and how it contributes to your net worth.

- Asset categories
- Purchase value
- Current value
- Gain / loss tracking
- Net-worth breakdown
- Archive management

---

### 💳 Debts

Track both sides of your personal debts.

- **I owe**
- **They owe me**
- Partial payments
- Payment history
- Automatic settlement
- Due-date reminders

---

### 🧾 Bills

Keep recurring payments under control.

- Recurring frequencies
- Due dates
- Mark as paid
- Automatic next due date
- Calendar view
- Payment history
- Reminders

---

### 🔧 Maintenance

Never forget recurring maintenance again.

Designed for things such as:

- Vehicle maintenance
- Electronics
- Appliances
- Home maintenance
- Other recurring tasks

Each maintenance item can track its schedule, completion history, and cost.

---

### 🔔 Inbox

A dedicated place for reminders and notifications.

- Unread
- Read
- Archived
- Automatically generated due notifications

---

### 👤 Profile & Security

Personal settings and account controls.

- Avatar & profile information
- Username
- Light / Dark / System theme
- 6-digit PIN lock
- Secure bcrypt PIN hashing
- Biometric placeholder
- Password management
- Sign out

---

## 🧩 Tech Stack

### Frontend

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)

### Backend & Data

![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

### Libraries

![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=for-the-badge&logo=reactquery&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-433E38?style=for-the-badge)
![Zod](https://img.shields.io/badge/Zod-3068B7?style=for-the-badge)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide-000000?style=for-the-badge)
![Sonner](https://img.shields.io/badge/Sonner-000000?style=for-the-badge)

---

## 🏗️ Architecture

ARAH follows a **single-owner architecture**.

Every user-owned record is protected through Supabase Row Level Security (RLS), ensuring that personal data remains accessible only to its owner.

### Database-driven logic

Important financial calculations are handled at the database level rather than relying entirely on the frontend.

Database triggers help keep:

- Account balances
- Goal progress
- Debt settlement
- Bill schedules
- Maintenance schedules

consistent across the application.

### Authentication

Authentication is handled through Supabase with:

- Email & password authentication
- Password reset
- Protected routes
- Session refresh middleware
- Optional PIN lock

---

## 📂 Project Structure

```text
supabase/
├── migrations/          # Database schema, RLS, triggers & functions
└── seed.sql             # Optional sample data

src/
├── app/
│   ├── (auth)/          # Login, register & password reset
│   └── (app)/
│       ├── home/
│       ├── money/
│       ├── goals/
│       ├── assets/
│       ├── debts/
│       ├── bills/
│       ├── maintenance/
│       ├── inbox/
│       ├── profile/
│       └── create-pin/
│
├── components/          # App shell & reusable UI
├── hooks/               # Data & profile hooks
├── lib/                 # Supabase clients, types & utilities
└── stores/              # Zustand state management

middleware.ts            # Session refresh & route protection
