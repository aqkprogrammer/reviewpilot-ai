import { Suspense } from "react";
import { FeedbackPage } from "@/components/feedback/feedback-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f5fb]" />}>
      <FeedbackPage slug={slug} />
    </Suspense>
  );
}
