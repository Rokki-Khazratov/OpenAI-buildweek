import type { ReactNode } from "react";

import { DemoProvider } from "@/features/demo/demo-provider";

export default function ExamSessionLayout({ children }: { children: ReactNode }) {
  return <DemoProvider>{children}</DemoProvider>;
}
