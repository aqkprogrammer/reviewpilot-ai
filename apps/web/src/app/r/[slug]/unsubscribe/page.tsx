import { Suspense } from "react";
import { Unsubscribe } from "@/components/feedback/unsubscribe";

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f3f6f7]" />}>
      <Unsubscribe />
    </Suspense>
  );
}
