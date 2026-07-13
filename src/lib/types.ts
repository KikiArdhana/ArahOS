export type AccountType = "cash" | "bank" | "ewallet" | "investment" | "other";
export type TransactionType = "income" | "expense";
export type GoalStatus = "active" | "completed" | "archived";
export type AssetCategory =
  "property" | "vehicle" | "electronics" | "investment" | "jewelry" | "other";
export type AssetStatus = "active" | "sold" | "archived";
export type DebtDirection = "i_owe" | "they_owe";
export type DebtStatus = "open" | "settled";
export type BillFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type MaintenanceFrequency = "weekly" | "monthly" | "quarterly" | "semiannual" | "yearly";
export type NotificationType = "bill" | "debt" | "maintenance" | "goal" | "system";
export type NotificationStatus = "unread" | "read" | "archived";

export interface Profile {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  pin_hash: string | null;
  biometric_enabled: boolean;
  theme: "light" | "dark" | "system";
  currency: string;
  locale: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  owner: string; 
  balance: number;
  color: string;
  icon: string;
  is_archived: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  kind: TransactionType;
  icon: string;
  color: string;
  is_default: boolean;
}

export interface Allocation {
  id: string;
  account_id: string | null;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  period: "weekly" | "monthly" | "yearly" | "none";
}

export interface Transaction {
  id: string;
  account_id: string;
  category_id: string | null;
  allocation_id: string | null;
  type: TransactionType;
  amount: number;
  note: string | null;
  occurred_at: string;
  accounts?: { name: string } | null;
  categories?: { name: string; icon: string } | null;
}

export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  note: string | null;
  occurred_at: string;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  status: GoalStatus;
  completed_at: string | null;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  account_id: string | null;
  amount: number;
  note: string | null;
  occurred_at: string;
}

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  value: number;
  purchase_value: number | null;
  purchase_date: string | null;
  status: AssetStatus;
  note: string | null;
}

export interface Debt {
  id: string;
  counterparty: string;
  direction: DebtDirection;
  amount: number;
  paid_amount: number;
  due_date: string | null;
  status: DebtStatus;
  note: string | null;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  note: string | null;
  occurred_at: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  next_due_date: string;
  reminder_days: number;
  auto_pay: boolean;
  is_active: boolean;
  note: string | null;
}

export interface BillPayment {
  id: string;
  bill_id: string;
  account_id: string | null;
  amount: number;
  paid_for_date: string;
  occurred_at: string;
}

export interface Maintenance {
  id: string;
  asset_id: string | null;
  name: string;
  frequency: MaintenanceFrequency;
  next_due_date: string;
  reminder_days: number;
  estimated_cost: number | null;
  is_active: boolean;
  note: string | null;
}

export interface MaintenanceHistory {
  id: string;
  maintenance_id: string;
  cost: number | null;
  note: string | null;
  done_at: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  status: NotificationStatus;
  ref_id: string | null;
  created_at: string;
}
