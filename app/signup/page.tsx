import Link from "next/link";
import { SignUpForm } from "@/components/public/AuthForm";

export default function SignUpPage() {
  return (
    <AuthCard title="Create your account" kicker="Sign up">
      <SignUpForm />
      <p className="mt-6 text-sm text-mute">
        Already have an account?{" "}
        <Link href="/login" className="text-need">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export function AuthCard({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{kicker}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">{title}</h1>
      <div className="mt-8">{children}</div>
    </div>
  );
}
