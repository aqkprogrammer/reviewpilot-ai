"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock, MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackList } from "@/components/reviews/feedback-list";
import { ReviewDrawer } from "@/components/reviews/review-drawer";
import { EMPTY_FILTERS, ReviewList, ReviewStatsStrip, type ReviewFilters } from "@/components/reviews/review-list";

function ReviewsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") === "feedback" ? "feedback" : "reviews";
  const reviewId = params.get("review");
  const [filters, setFilters] = React.useState<ReviewFilters>(() => ({ ...EMPTY_FILTERS, status: params.get("status") ?? "" }));

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" description="Read, reply to and resolve feedback from every location — AI drafts, you approve." />
      <Tabs value={tab} onValueChange={(v) => setParam("tab", v === "feedback" ? "feedback" : null)}>
        <TabsList variant="underline" className="mb-5">
          <TabsTrigger value="reviews"><MessageSquareText /> Public reviews</TabsTrigger>
          <TabsTrigger value="feedback"><Lock /> Private feedback</TabsTrigger>
        </TabsList>
        <TabsContent value="reviews" className="space-y-5">
          <ReviewStatsStrip />
          <ReviewList filters={filters} setFilters={setFilters} onOpen={(id) => setParam("review", id)} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackList />
        </TabsContent>
      </Tabs>
      <ReviewDrawer reviewId={reviewId} onClose={() => setParam("review", null)} />
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <React.Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-96" /></div>}>
      <ReviewsInner />
    </React.Suspense>
  );
}
