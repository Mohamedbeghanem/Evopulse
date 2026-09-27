import { ResetForm } from "@/components/public/AuthForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Reset</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">Choose a new password.</h1>
      <div className="mt-8">
        {token ? <ResetForm token={token} /> : <p className="text-sand">This reset link is missing a token.</p>}
      </div>
    </div>
  );
}
