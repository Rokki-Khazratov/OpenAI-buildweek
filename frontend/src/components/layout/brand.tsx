import Link from "next/link";

export function Brand() {
  return (
    <Link href="/home" className="inline-flex items-center" aria-label="ExamTwin home">
      <span className="text-[17px] font-semibold tracking-[-0.035em]">ExamTwin</span>
    </Link>
  );
}
