import type { ReactNode } from "react";

export function PageFrame({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page-enter mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <header className="mb-8 flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">{eyebrow}</p>}
          <h1 className="text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[36px]">{title}</h1>
          {description && <p className="mt-2.5 max-w-2xl text-[15px] leading-6 text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </div>
  );
}
