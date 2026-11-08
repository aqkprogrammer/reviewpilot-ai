"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CircleCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { api, errorMessage } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(254),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(4000),
});
type Values = z.infer<typeof schema>;

export function ContactForm({ defaultMessage = "" }: { defaultMessage?: string }) {
  const [sent, setSent] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", company: "", message: defaultMessage } });

  const onSubmit = async (values: Values) => {
    try {
      await api.post("/public/contact", { ...values, company: values.company || null }, { orgId: null });
      setSent(true);
      reset();
    } catch (err) {
      toast.error("We couldn't send your message", { description: errorMessage(err) });
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
        <div className="flex size-12 items-center justify-center rounded-full bg-success-soft">
          <CircleCheck className="size-6 text-success-foreground" />
        </div>
        <h2 className="mt-4 text-[18px] font-semibold text-foreground">Message received</h2>
        <p className="mt-1.5 max-w-sm text-[14px] text-muted-foreground">Thanks for reaching out. Someone from our team will reply by email within one business day.</p>
        <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>Send another message</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="c-name" error={errors.name?.message} required>
          <Input id="c-name" autoComplete="name" invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label="Work email" htmlFor="c-email" error={errors.email?.message} required>
          <Input id="c-email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
        </FormField>
      </div>
      <FormField label="Business name" htmlFor="c-company" error={errors.company?.message} hint="Optional">
        <Input id="c-company" autoComplete="organization" {...register("company")} />
      </FormField>
      <FormField label="How can we help?" htmlFor="c-message" error={errors.message?.message} required>
        <Textarea id="c-message" rows={5} invalid={!!errors.message} {...register("message")} />
      </FormField>
      <p className="text-[12px] text-muted-foreground">
        We&apos;ll only use these details to respond to your enquiry. See our <a href="/privacy" className="text-primary hover:underline">privacy policy</a>.
      </p>
      <Button type="submit" variant="gradient" size="lg" loading={isSubmitting} className="w-full sm:w-auto sm:px-8">
        <Send /> Send message
      </Button>
    </form>
  );
}
