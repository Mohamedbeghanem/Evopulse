"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui/primitives";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyHref, setVerifyHref] = useState<string | null>(null);

  async function onSubmit(form: FormData) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") || ""),
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
      }),
    });
    const data = (await res.json()) as { error?: string; verifyHref?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create the account.");
      return;
    }
    setVerifyHref(data.verifyHref || null);
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form action={(form) => void onSubmit(form)} className="space-y-4">
      <Field id="name" label="Your name" name="name" required />
      <Field id="email" label="Email" name="email" type="email" required />
      <Field id="password" label="Password" name="password" type="password" minLength={8} required />
      {error ? <p className="text-sm text-miss">{error}</p> : null}
      {verifyHref ? (
        <p className="text-sm text-sand">
          Verify your email:{" "}
          <Link href={verifyHref} className="text-need">
            confirm address
          </Link>
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(form: FormData) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
      }),
    });
    const data = (await res.json()) as { error?: string; onboardingCompleted?: boolean };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not sign in.");
      return;
    }
    router.push(data.onboardingCompleted ? "/pulse" : "/onboarding");
    router.refresh();
  }

  return (
    <form action={(form) => void onSubmit(form)} className="space-y-4">
      <Field id="email" label="Email" name="email" type="email" required />
      <Field id="password" label="Password" name="password" type="password" required />
      {error ? <p className="text-sm text-miss">{error}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [resetHref, setResetHref] = useState<string | null>(null);

  async function onSubmit(form: FormData) {
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(form.get("email") || "") }),
    });
    const data = (await res.json()) as { resetHref?: string };
    setMessage("If that email exists, a reset link is ready.");
    setResetHref(data.resetHref || null);
  }

  return (
    <form action={(form) => void onSubmit(form)} className="space-y-4">
      <Field id="email" label="Email" name="email" type="email" required />
      <Button type="submit" className="w-full">
        Send reset link
      </Button>
      {message ? <p className="text-sm text-sand">{message}</p> : null}
      {resetHref ? (
        <p className="text-sm">
          <Link href={resetHref} className="text-need">
            Continue to reset password
          </Link>
        </p>
      ) : null}
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(form: FormData) {
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: String(form.get("password") || "") }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Could not reset password.");
      return;
    }
    router.push("/login");
  }

  return (
    <form action={(form) => void onSubmit(form)} className="space-y-4">
      <Field id="password" label="New password" name="password" type="password" minLength={8} required />
      {error ? <p className="text-sm text-miss">{error}</p> : null}
      <Button type="submit" className="w-full">
        Update password
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className="text-sm text-sand">{label}</span>
      <Input id={id} {...props} />
    </label>
  );
}
