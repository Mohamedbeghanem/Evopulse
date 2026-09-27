import Link from "next/link";
import { SignInForm } from "@/components/public/AuthForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Sign in</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">Welcome back.</h1>
      <div className="mt-8">
        <SignInForm />
      </div>
      <p className="mt-6 text-sm text-mute">
        <Link href="/forgot-password" className="text-need">
          Forgot password
        </Link>
        {" · "}
        <Link href="/signup" className="text-need">
          Create an account
        </Link>
      </p>
    </div>
  );
}
