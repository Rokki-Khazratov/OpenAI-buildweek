import type { ReactNode } from "react";

import { ProductShell } from "@/components/layout/product-shell";
import { CurrentUserProvider } from "@/features/auth/current-user-provider";
import { DemoProvider } from "@/features/demo/demo-provider";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <CurrentUserProvider>
      <DemoProvider>
        <ProductShell>{children}</ProductShell>
      </DemoProvider>
    </CurrentUserProvider>
  );
}
