"use client";

import { Children, cloneElement, forwardRef, isValidElement } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "dark";
type Size = "sm" | "md" | "lg";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  asChild?: boolean;
  children?: React.ReactNode;
};

type Props = CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition " +
  "duration-200 ease-out will-change-transform active:scale-[0.98] disabled:opacity-50 " +
  "disabled:pointer-events-none whitespace-nowrap cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_8px_24px_-8px_rgba(234,88,12,0.45)]",
  ghost: "text-ink hover:bg-ink/[0.04]",
  outline:
    "border border-hairline bg-white text-ink hover:border-ink/30 hover:shadow-soft",
  dark: "bg-ink text-white hover:bg-ink/85",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[14px]",
  lg: "h-[52px] px-6 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", asChild, children, ...props },
  ref
) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if (asChild && isValidElement(children)) {
    // Slot pattern: pass the styling through to the child element (typically <a>).
    const child = Children.only(children) as React.ReactElement<{ className?: string }>;
    return cloneElement(child, {
      className: cn(classes, child.props.className),
      ...props,
    });
  }

  return (
    <button ref={ref} className={classes} {...props}>
      {children}
    </button>
  );
});
