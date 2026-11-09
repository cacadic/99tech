import { Toaster } from "sonner";
import { useDocumentTheme } from "@/shared/hooks/use-document-theme";

/** Toasts follow the app's own light/dark switch (not just the OS setting). */
export function ThemedToaster() {
  return <Toaster position="top-center" theme={useDocumentTheme()} />;
}
