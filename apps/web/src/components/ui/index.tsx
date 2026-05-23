import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "danger" | "secondary";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[4px] font-medium transition-colors disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-sm",
        variant === "default" &&
          "bg-notion-accent text-white hover:bg-notion-accent-hover",
        variant === "secondary" &&
          "border border-notion-border bg-white hover:bg-notion-hover",
        variant === "ghost" && "hover:bg-notion-hover text-notion-text",
        variant === "danger" &&
          "text-notion-danger hover:bg-red-50 border border-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[4px] border border-notion-border bg-white px-3 py-2 text-sm text-notion-text outline-none transition-shadow placeholder:text-notion-muted focus:border-notion-accent focus:ring-2 focus:ring-notion-accent/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-[4px] border border-notion-border bg-white px-3 py-2 text-sm text-notion-text outline-none focus:border-notion-accent focus:ring-2 focus:ring-notion-accent/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium text-notion-muted",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[6px] border border-notion-border bg-white shadow-[0_1px_2px_rgba(15,15,15,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[2rem] font-bold leading-tight tracking-[-0.02em] text-notion-text">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-notion-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[6px] border border-dashed border-notion-border bg-notion-sidebar/50 px-6 py-10 text-center">
      <p className="text-sm font-medium text-notion-text">{title}</p>
      {description && (
        <p className="mt-2 text-sm text-notion-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-notion-hover text-notion-muted",
        tone === "success" && "bg-emerald-50 text-notion-success",
        tone === "warning" && "bg-amber-50 text-amber-700",
        tone === "info" && "bg-blue-50 text-blue-700",
      )}
    >
      {children}
    </span>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[4px] border border-notion-border bg-white px-3 py-2 text-sm text-notion-text outline-none transition-shadow placeholder:text-notion-muted focus:border-notion-accent focus:ring-2 focus:ring-notion-accent/20",
        className,
      )}
      {...props}
    />
  );
}
