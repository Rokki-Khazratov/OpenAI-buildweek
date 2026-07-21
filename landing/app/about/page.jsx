import Image from "next/image";
import Link from "next/link";
import styles from "./about.module.css";

export const metadata = {
  title: "About us — ExamTwin",
  description: "ExamTwin is built by Bek and Ilya, students building from Vienna.",
};

const Arrow = () => <span aria-hidden="true">↗</span>;

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link href="/" className={styles.brand}>EXAMTWIN<span>.</span></Link>
          <Link href="/" className={styles.back}>← Back to home</Link>
        </nav>

        <section className={styles.story}>
          <p className={styles.kicker}><span /> About us</p>
          <h1>By students,<br />for students.</h1>
          <div className={styles.copy}>
            <p>We&apos;re Bek and Ilya — two students building ExamTwin from Vienna. We know the feeling of collecting notes, slides and past papers, then still wondering what to practise next.</p>
            <p>So we&apos;re making the preparation partner we wished we had: one that understands the materials behind your real exam and helps you turn study time into evidence that you&apos;re ready.</p>
          </div>
        </section>

        <section className={styles.team} aria-labelledby="team-heading">
          <div className={styles.teamIntro}>
            <p className={styles.sectionLabel}>The people behind ExamTwin</p>
            <h2 id="team-heading">Built together<br />in Vienna.</h2>
          </div>

          <div className={styles.cards}>
            <article className={styles.card}>
              <div className={`${styles.photo} ${styles.placeholder}`} aria-label="Ilya photo placeholder">
                <span>Photo<br />coming soon</span>
              </div>
              <p className={styles.role}>Product & learning</p>
              <h3>Ilya</h3>
              <p className={styles.bio}>Ilya shapes the learning experience — translating the reality of student life into focused practice that feels clear, calm and useful.</p>
              <div className={styles.tags}>
                <span>Student perspective</span>
                <span>Product</span>
                <span>Learning design</span>
              </div>
              <p className={styles.pending}>LinkedIn & GitHub coming soon</p>
            </article>

            <article className={styles.card}>
              <div className={styles.photo}>
                <Image src="/team/bek-khazratov.jpg" alt="Bek Khazratov" fill sizes="(max-width: 760px) 100vw, 50vw" priority className={styles.image} />
              </div>
              <p className={styles.role}>Engineering</p>
              <h3>Bek Khazratov</h3>
              <p className={styles.bio}>Bek builds the technical foundation: the AI flows, product architecture and systems that turn course material into a genuinely adaptive exam rehearsal.</p>
              <div className={styles.tags}>
                <span>Full-stack engineering</span>
                <span>AI workflows</span>
                <span>Vienna</span>
              </div>
              <div className={styles.links}>
                <a href="https://www.linkedin.com/in/bek-khazratov-751954225/" target="_blank" rel="noreferrer">LinkedIn <Arrow /></a>
                <a href="https://github.com/Rokki-Khazratov" target="_blank" rel="noreferrer">GitHub <Arrow /></a>
              </div>
            </article>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} ExamTwin · Vienna</span>
          <a href="https://khazratov.com">Start rehearsing →</a>
        </footer>
      </div>
    </main>
  );
}
