import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A number field with a "$" shown inside it. The value stays a plain number string. */
export function MoneyInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted-foreground">
        $
      </span>
      <Input inputMode="decimal" className={cn("pl-7", className)} {...props} />
    </div>
  );
}
