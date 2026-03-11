"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogSize = "auto" | "sm" | "md" | "lg" | "xl" | "full";

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: DialogSize;
}

const SIZE_CLASSES: Record<DialogSize, string> = {
  sm: "max-w-[500px] h-[600px]",
  md: "max-w-[600px] h-[600px]",
  lg: "max-w-[800px] h-[600px]",
  xl: "sm:max-w-[95vw] max-w-[95vw] h-[85vh]",
  full: "max-w-[100vw] w-[100vw] h-[95vh] rounded-none",
  auto: "max-w-[500px] h-[600px]",
};

const FOOTER_DISPLAY_NAME = "DialogFooter";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size = "auto", ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [computedSize, setComputedSize] = React.useState<DialogSize>(size);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const titleEl = contentRef.current?.querySelector('[data-testid*="dialog-title"], [data-testid*="title"], h2, h3');
      const dialogLabel = titleEl?.textContent?.trim() || "Neznámy dialóg";
      fetch("/api/click-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buttonLabel: `Dialog otvorený: ${dialogLabel}`, module: "DIALOG_OPEN" }),
      }).catch(() => {});
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const setRefs = React.useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [ref]);

  const computeAutoSize = React.useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      setComputedSize("full");
      return;
    }

    const hasTable = el.querySelector("table") !== null;
    if (hasTable) {
      setComputedSize("xl");
      return;
    }

    const inputs = el.querySelectorAll(
      "input, select, textarea, [role=combobox], [role=listbox], [role=switch], [role=checkbox]"
    );
    const fieldCount = inputs.length;

    if (fieldCount > 15) {
      setComputedSize("lg");
    } else if (fieldCount > 5) {
      setComputedSize("md");
    } else {
      setComputedSize("sm");
    }
  }, []);

  React.useEffect(() => {
    if (size !== "auto") {
      setComputedSize(size);
      return;
    }

    computeAutoSize();

    const handleResize = () => computeAutoSize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size, children, computeAutoSize]);

  const footerChildren: React.ReactNode[] = [];
  const otherChildren: React.ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (
      React.isValidElement(child) &&
      typeof child.type !== "string" &&
      (child.type as any).displayName === FOOTER_DISPLAY_NAME
    ) {
      footerChildren.push(child);
    } else {
      otherChildren.push(child);
    }
  });

  const hasFooter = footerChildren.length > 0;

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setRefs}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target?.closest?.("[role='listbox'], [role='option'], [data-radix-select-viewport], [data-radix-popper-content-wrapper], [data-radix-collection-item]")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target?.closest?.("[role='listbox'], [role='option'], [data-radix-select-viewport], [data-radix-popper-content-wrapper], [data-radix-collection-item]")) {
            e.preventDefault();
          }
        }}
        className={cn(
          "fixed left-[50%] top-12 z-50 w-full translate-x-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[5%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[5%] sm:rounded-lg flex flex-col overflow-hidden",
          SIZE_CLASSES[computedSize],
          className
        )}
        {...props}
      >
        <div className={cn("flex-1 min-h-0 overflow-y-auto px-6", hasFooter && "pb-0")}>
          {otherChildren}
        </div>

        {hasFooter && footerChildren}

        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-20">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left sticky top-0 z-10 bg-background pt-6 pb-4 -mx-6 px-6 border-b border-border/60",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "shrink-0 h-[64px] flex items-center justify-between sm:justify-end sm:space-x-2 px-6 bg-background border-t border-border/60",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

const DialogScrollContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("py-4", className)}
    {...props}
  />
)
DialogScrollContent.displayName = "DialogScrollContent"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogScrollContent,
}

export type { DialogSize }
