import { ForgotForm } from "@/components/public/AuthForm";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Reset</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">Forgot your password?</h1>
      <p className="mt-3 text-sm text-sand">We’ll prepare a reset link for that email.</p>
      <div className="mt-8">
        <ForgotForm />
      </div>
    </div>
  );
}
