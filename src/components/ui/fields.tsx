import type React from "react";
import { cn } from "@/lib/cn";

const base =
  "w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-fg " +
  "placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function TextField({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

export function TextAreaField({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-[110px]", className)} {...props} />;
}

export function SelectField({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select className={cn(base, "py-2.5", className)} {...props}>
      {children}
    </select>
  );
}

export function FieldLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <label className={cn("text-sm font-medium text-fg", className)}>{children}</label>;
}

export function FieldHint({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={cn("text-xs leading-5 text-faint", className)}>{children}</p>;
}
