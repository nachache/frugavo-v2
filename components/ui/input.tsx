"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-[52px] w-full rounded-full border border-hairline bg-white px-5 text-[15px]",
        "text-ink placeholder:text-ink-muted",
        "transition focus:border-brand/40",
        className
      )}
      {...props}
    />
  );
});
