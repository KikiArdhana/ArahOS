"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface ListOptions {
  select?: string;
  match?: Record<string, string | number | boolean>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}

/** Generic Supabase table hooks — list + insert + update + remove, cache-aware. */
export function useTable<T extends { id: string }>(table: string, options: ListOptions = {}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const key = [table, options];

  const list = useQuery<T[]>({
    queryKey: key,
    queryFn: async () => {
      let q = supabase.from(table).select(options.select ?? "*");
      if (options.match) q = q.match(options.match);
      q = q.order(options.order?.column ?? "created_at", {
        ascending: options.order?.ascending ?? false,
      });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as T[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries();

  const insert = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from(table)
        .insert({ ...values, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as T;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from(table)
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as T;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...list, items: list.data ?? [], insert, update, remove };
}
