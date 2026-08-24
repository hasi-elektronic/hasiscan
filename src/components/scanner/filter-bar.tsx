import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { applyFilter, type FilterId } from "@/lib/image-process";
import { t, type MsgKey } from "@/lib/i18n";
import { useSettings } from "@/stores/settings";

const FILTERS: { id: FilterId; key: MsgKey }[] = [
  { id: "original", key: "filterOriginal" },
  { id: "magic", key: "filterMagic" },
  { id: "bw", key: "filterBw" },
  { id: "color", key: "filterColor" },
];

export function FilterBar({
  src,
  value,
  onChange,
}: {
  src: string;
  value: FilterId;
  onChange: (id: FilterId) => void;
}) {
  const lang = useSettings((s) => s.lang);
  const [previews, setPreviews] = useState<Partial<Record<FilterId, string>>>({
    original: src,
  });

  useEffect(() => {
    let cancelled = false;
    setPreviews({ original: src });
    void (async () => {
      for (const f of FILTERS) {
        if (f.id === "original") continue;
        const url = await applyFilter(src, f.id);
        if (cancelled) return;
        setPreviews((p) => ({ ...p, [f.id]: url }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={cn(
            "flex w-20 shrink-0 flex-col gap-1.5 rounded-xl p-1 text-left transition-opacity duration-150",
            value === f.id
              ? "bg-surface ring-2 ring-accent"
              : "opacity-70 hover:opacity-100",
          )}
        >
          <span className="block aspect-[3/4] overflow-hidden rounded-lg bg-surface-2">
            {previews[f.id] && (
              <img
                src={previews[f.id]}
                alt=""
                className="size-full object-cover"
              />
            )}
          </span>
          <span className="px-0.5 text-center text-[0.6875rem] font-medium text-muted">
            {t(lang, f.key)}
          </span>
        </button>
      ))}
    </div>
  );
}
