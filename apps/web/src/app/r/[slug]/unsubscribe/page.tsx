import { Suspense } from "react";
import { Unsubscribe } from "@/components/feedback/unsubscribe";

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f5fb]" />}>
      <Unsubscribe />
    </Suspense>
  );
}
