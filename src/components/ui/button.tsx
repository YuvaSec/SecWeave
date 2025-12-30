import type React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "ghost";

type ButtonProps = {
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
} & (
  | React.ButtonHTMLAttributes<HTMLButtonElement>
  | ({ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
);

export function Button(props: ButtonProps) {
  const variant: ButtonVariant =
    "variant" in props && props.variant ? props.variant : "primary";

  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  const styles =
    variant === "primary"
      ? "bg-accent text-accentContrast shadow-soft hover:opacity-95"
      : "border border-border bg-transparent text-fg hover:bg-panel2";

  if ("href" in props && typeof props.href === "string") {
    const { href, className, children, ...rest } = props;
    return (
      <Link href={href} className={cn(base, styles, className)} {...rest}>
        {children}
      </Link>
    );
  }

  const { className, children, ...rest } =
    props as React.ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button className={cn(base, styles, className)} {...rest}>
      {children}
    </button>
  );
}
