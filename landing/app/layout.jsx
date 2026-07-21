import "./globals.css";
import { Instrument_Sans } from "next/font/google";

const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata = {
  title: "ExamTwin — Rehearse what matters next",
  description: "Adaptive exam rehearsals built from the materials that define your real exam.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={instrument.className}>{children}</body>
    </html>
  );
}
