"use client";
import { Checkbox } from "@/components/ui/controls";
import { useOrg } from "@/lib/session";

export function LocationPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { locations } = useOrg();
  if (!locations.length) return <p className="text-xs text-muted-foreground">No locations yet.</p>;
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2 scrollbar-thin">
      {locations.map((l) => (
        <label key={l.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-muted">
          <Checkbox checked={value.includes(l.id)} onCheckedChange={(c) => onChange(c === true ? [...value, l.id] : value.filter((x) => x !== l.id))} />
          {l.name}
        </label>
      ))}
    </div>
  );
}
