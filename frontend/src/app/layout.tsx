import type { Metadata } from "next";
import "@fontsource-variable/instrument-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ExamTwin",
    template: "%s · ExamTwin",
  },
  description: "Reconstruct the real exam. Practice with intent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
