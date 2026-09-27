import Link from "next/link";
import { AuthService } from "@/lib/auth";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let ok = false;
  let message = "This verification link is missing a token.";
  if (token) {
    try {
      AuthService.verifyEmail(token);
      ok = true;
      message = "Your email is verified.";
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not verify email.";
    }
  }
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Email</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">{ok ? "Confirmed." : "Verification"}</h1>
      <p className="mt-4 text-sand">{message}</p>
      <Link href={ok ? "/onboarding" : "/login"} className="mt-6 inline-flex text-need">
        Continue
      </Link>
    </div>
  );
}
