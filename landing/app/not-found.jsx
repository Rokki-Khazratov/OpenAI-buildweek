import Link from "next/link";

export const metadata = {
  title: "Page not found — ExamTwin",
};

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#141410", color: "#f3f2e8" }}>
      <section style={{ width: "min(680px, 100%)", textAlign: "center" }}>
        <p style={{ color: "#c5f43f", fontWeight: 700, letterSpacing: ".12em", fontSize: "13px", margin: 0 }}>ERROR 404</p>
        <h1 style={{ fontSize: "clamp(56px, 12vw, 120px)", lineHeight: ".88", letterSpacing: "-.08em", margin: "22px 0" }}>This question isn&apos;t on the exam.</h1>
        <p style={{ margin: "0 auto 34px", maxWidth: "450px", color: "#b4b2a5", fontSize: "18px", lineHeight: 1.45 }}>The page you&apos;re looking for does not exist, but your next focused rehearsal is only one click away.</p>
        <Link href="/" style={{ display: "inline-block", borderRadius: "12px", padding: "15px 22px", background: "#c5f43f", color: "#12160a", fontWeight: 700, textDecoration: "none" }}>Return to ExamTwin →</Link>
      </section>
    </main>
  );
}
