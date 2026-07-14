import { ArrowRight, LockKeyhole, type LucideIcon } from "lucide-react";

import { PageFrame } from "@/components/layout/page-frame";
import { StatusPill } from "@/components/ui/status-pill";

export function FeaturePreview({
  eyebrow,
  title,
  description,
  icon: Icon,
  items,
  soon = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  items: { title: string; text: string }[];
  soon?: boolean;
}) {
  return (
    <PageFrame eyebrow={eyebrow} title={title} action={soon ? <StatusPill>Soon</StatusPill> : undefined}>
      <section className={`overflow-hidden rounded-[16px] border border-line ${soon ? "bg-surface-raised" : "bg-white"}`}>
        <div className="grid min-h-[220px] place-items-center border-b border-line p-8 text-center">
          <div className="max-w-xl">
            <span className={`mx-auto grid size-12 place-items-center rounded-[12px] ${soon ? "bg-[#ebebed] text-muted" : "bg-signal-soft text-signal"}`}><Icon size={21} strokeWidth={1.7} /></span>
            <h2 className="mt-5 text-xl font-semibold tracking-[-0.025em]">{soon ? "The data layer comes next." : "The product surface is mapped."}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3">
          {items.map((item, index) => <div key={item.title} className={`p-5 sm:p-6 ${index < items.length - 1 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}><span className="font-mono text-[11px] text-muted">0{index + 1}</span><h3 className="mt-6 text-sm font-semibold">{item.title}</h3><p className="mt-2 text-xs leading-5 text-muted">{item.text}</p><span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted">{soon ? <><LockKeyhole size={13} /> Not available yet</> : <>Planned <ArrowRight size={13} /></>}</span></div>)}
        </div>
      </section>
    </PageFrame>
  );
}
