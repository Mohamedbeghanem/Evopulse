import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "border border-risk bg-risk text-[#0A0C0F] hover:border-risk-fg hover:bg-risk-fg",
  secondary: "border border-os-line-2 bg-os-raise text-fg hover:bg-[#1C2430] hover:text-white",
  ghost: "border border-transparent text-fg-3 hover:bg-os-raise hover:text-fg",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-[34px] px-3.5 text-[13px]",
  lg: "h-9 px-3.5 text-[13px]",
};

export function buttonClass({ variant = "secondary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ctl font-sans font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]}`;
}

export function Button({
  variant,
  size,
  className = "",
  type = "button",
  ...rest
}: { variant?: Variant; size?: Size } & ComponentPropsWithoutRef<"button">) {
  return <button type={type} className={`${buttonClass({ variant, size })} ${className}`} {...rest} />;
}

export function ButtonLink({
  variant,
  size,
  className = "",
  ...rest
}: { variant?: Variant; size?: Size } & ComponentPropsWithoutRef<typeof Link>) {
  return <Link className={`${buttonClass({ variant, size })} ${className}`} {...rest} />;
}
