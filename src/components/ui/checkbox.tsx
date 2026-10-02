import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, onCheckedChange, ...props }, ref) => {
  const checkboxRef = React.useRef<React.ElementRef<typeof CheckboxPrimitive.Root>>(null);

  React.useImperativeHandle(ref, () => checkboxRef.current!);

  const handleCheckedChange = (checked: CheckboxPrimitive.CheckedState) => {
    onCheckedChange?.(checked);

    if (checked === true && checkboxRef.current?.closest("table")) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  return (
    <CheckboxPrimitive.Root
      ref={checkboxRef}
      className={cn(
        "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className,
      )}
      onCheckedChange={handleCheckedChange}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-current")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
