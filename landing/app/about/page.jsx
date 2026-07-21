import Link from "next/link";

export const metadata = {
  title: "About ExamTwin",
  description: "The story behind ExamTwin's adaptive exam rehearsal platform.",
};

const styles = {
  page: { minHeight: "100vh", background: "#efeee4", color: "#0e0e0b", padding: "24px" },
  shell: { maxWidth: "1120px", margin: "0 auto" },
  nav: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 72px", gap: "20px" },
  brand: { color: "inherit", textDecoration: "none", fontWeight: 700, fontSize: "20px", letterSpacing: "-.02em" },
  back: { color: "#0e0e0b", textDecoration: "none", fontSize: "14px", fontWeight: 600, border: "1px solid #c8c5b3", borderRadius: "999px", padding: "10px 16px" },
  hero: { maxWidth: "850px", padding: "clamp(28px, 6vw, 78px) 0 clamp(60px, 9vw, 118px)" },
  eyebrow: { display: "inline-block", borderRadius: "999px", background: "#c5f43f", padding: "8px 12px", fontSize: "12px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" },
  h1: { fontSize: "clamp(48px, 8vw, 100px)", lineHeight: ".93", letterSpacing: "-.07em", margin: "24px 0", maxWidth: "800px" },
  lead: { fontSize: "clamp(19px, 2.4vw, 27px)", lineHeight: 1.35, letterSpacing: "-.025em", color: "#4d4c43", maxWidth: "680px", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "16px", marginBottom: "96px" },
  card: { border: "1px solid #dcd9cb", borderRadius: "20px", padding: "28px", background: "#f8f7f0" },
  cardTitle: { fontSize: "14px", textTransform: "uppercase", letterSpacing: ".08em", color: "#6b6a5f", margin: "0 0 28px" },
  cardText: { fontSize: "20px", letterSpacing: "-.03em", lineHeight: 1.25, margin: 0 },
  manifesto: { background: "#4b39f7", color: "#f4f3ff", borderRadius: "28px", padding: "clamp(32px, 6vw, 72px)", marginBottom: "40px" },
  manifestoTitle: { fontSize: "clamp(34px, 5vw, 64px)", lineHeight: ".98", letterSpacing: "-.06em", maxWidth: "760px", margin: 0 },
  footer: { padding: "26px 0 14px", color: "#6b6a5f", fontSize: "14px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" },
};

export default function AboutPage() {
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <nav style={styles.nav}>
          <Link href="/" style={styles.brand}>EXAMTWIN<span style={{ color: "#4b39f7" }}>.</span></Link>
          <Link href="/" style={styles.back}>← Back to home</Link>
        </nav>

        <section style={styles.hero}>
          <span style={styles.eyebrow}>Our story</span>
          <h1 style={styles.h1}>The exam is real. Your practice should be too.</h1>
          <p style={styles.lead}>ExamTwin turns the materials that shape your course into adaptive rehearsal loops, so every revision session has a clear reason to exist.</p>
        </section>

        <section style={styles.grid}>
          <article style={styles.card}>
            <p style={styles.cardTitle}>The problem</p>
            <p style={styles.cardText}>Students revise from generic question banks, then face an exam built around completely different material.</p>
          </article>
          <article style={styles.card}>
            <p style={styles.cardTitle}>Our belief</p>
            <p style={styles.cardText}>Good preparation is specific: it reflects your syllabus, your weak spots, and the way your understanding evolves.</p>
          </article>
          <article style={styles.card}>
            <p style={styles.cardTitle}>Our approach</p>
            <p style={styles.cardText}>We build a living exam twin from your real sources, then use each answer to make the next session smarter.</p>
          </article>
        </section>

        <section style={styles.manifesto}>
          <h2 style={styles.manifestoTitle}>Less anxious cramming. More evidence that you&apos;re ready.</h2>
        </section>

        <footer style={styles.footer}>
          <span>© {new Date().getFullYear()} ExamTwin</span>
          <Link href="/" style={{ color: "inherit" }}>Start rehearsing →</Link>
        </footer>
      </div>
    </main>
  );
}
