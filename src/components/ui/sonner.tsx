import { Toaster as Sonner } from "sonner";
import { CheckCircle2, CircleX, Info, LoaderCircle, TriangleAlert } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--toast-close-button-start": "auto",
          "--toast-close-button-end": "0px",
          "--toast-close-button-transform": "translate(35%, -35%)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
        closeButton: true,
        duration: 3000,
      }}
      icons={{
        success: <CheckCircle2 className="size-4 text-black" />,
        info: <Info className="size-4 text-black" />,
        warning: <TriangleAlert className="size-4 text-black" />,
        error: <CircleX className="size-4 text-black" />,
        loading: <LoaderCircle className="size-4 animate-spin text-black" />,
      }}
      {...props}
    />
  );
};

export { Toaster };
