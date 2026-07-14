import { Check, Clock3 } from "lucide-react";

const parts = [
  { code: "A", title: "Concepts", meta: "8 questions", time: "20 min", weight: "20%", ready: true },
  { code: "B", title: "Derivations", meta: "4 problems", time: "45 min", weight: "40%", ready: true },
  { code: "C", title: "Applications", meta: "2 cases", time: "35 min", weight: "40%", ready: false },
];

export function BlueprintRail() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="text-sm font-semibold">Exam blueprint</p>
          <p className="mt-0.5 text-xs text-muted">Quantum Physics · Final 2025</p>
        </div>
        <span className="rounded-full bg-signal-soft px-2.5 py-1 text-[11px] font-semibold text-signal">2 of 3 verified</span>
      </div>
      <div className="grid md:grid-cols-3">
        {parts.map((part, index) => (
          <div key={part.code} className={`relative p-5 ${index < parts.length - 1 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}>
            <div className="mb-8 flex items-start justify-between">
              <span className={`grid size-8 place-items-center rounded-full text-xs font-semibold ${part.ready ? "bg-ink text-white" : "border border-dashed border-[#b9b9c0] text-muted"}`}>
                {part.ready ? <Check size={14} strokeWidth={2.2} /> : part.code}
              </span>
              <span className="font-mono text-[11px] text-muted">{part.weight}</span>
            </div>
            <p className="text-sm font-semibold">{part.title}</p>
            <p className="mt-1 text-xs text-muted">{part.meta}</p>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><Clock3 size={13} /> {part.time}</p>
            {index < parts.length - 1 && <span className="absolute left-[51px] top-9 hidden h-px w-[calc(100%-38px)] bg-line md:block" />}
          </div>
        ))}
      </div>
    </div>
  );
}
