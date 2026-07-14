import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/home" className="inline-flex items-center gap-2.5" aria-label="ExamTwin home">
      <span className="grid size-8 place-items-center rounded-[9px] bg-ink text-white shadow-sm">
        <span className="h-3.5 w-3.5 rounded-[3px] border-[1.5px] border-white/90 after:block after:mt-[3px] after:ml-[3px] after:h-[4px] after:w-[4px] after:rounded-[1px] after:bg-signal" />
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-[-0.02em]">ExamTwin</span>}
    </Link>
  );
}
