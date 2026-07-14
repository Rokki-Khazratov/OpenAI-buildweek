import type { ReactNode } from "react";

import { ProductShell } from "@/components/layout/product-shell";
import { DemoProvider } from "@/features/demo/demo-provider";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <ProductShell>{children}</ProductShell>
    </DemoProvider>
  );
}
