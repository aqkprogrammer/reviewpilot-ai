"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/controls";
import { ThemeProvider, useTheme } from "@/components/theme";
import { ApiError } from "@/lib/api";
import { installGlobalErrorListeners } from "@/lib/report-error";

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster position="bottom-right" theme={resolved} closeButton toastOptions={{ className: "!rounded-lg !border !border-[var(--border-strong)] !bg-[var(--popover)] !text-[var(--foreground)] !text-[13px] !shadow-lg" }} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => {
              if (err instanceof ApiError && err.status < 500) return false;
              return count < 2;
            },
          },
        },
      }),
  );
  // Uncaught errors / unhandled rejections → /api/v1/public/client-errors (deduped, capped per page load).
  React.useEffect(() => installGlobalErrorListeners(), []);
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <ThemedToaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
