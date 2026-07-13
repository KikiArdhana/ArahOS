"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/components/ui/primitives";

const schema = z
  .object({
    displayName: z.string().min(2, "At least 2 characters"),
    username: z
      .string()
      .min(3, "At least 3 characters")
      .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscores"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName, username: values.username },
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created");
    router.replace("/create-pin");
    router.refresh();
  };

  return (
    <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One owner. Everything personal. That&apos;s you.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Display name" error={errors.displayName?.message}>
          <Input placeholder="Your name" {...register("displayName")} />
        </Field>
        <Field label="Username" error={errors.username?.message}>
          <Input placeholder="yourname" autoCapitalize="none" {...register("username")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            {...register("email")}
          />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            {...register("password")}
          />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            {...register("confirm")}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link
          href="/login"
          className="font-semibold text-foreground underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
