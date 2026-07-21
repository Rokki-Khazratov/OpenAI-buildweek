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
            <p>Hi, we&apos;re two students in Vienna. While preparing for exams, we kept using ChatGPT, Claude, and Gemini, but every time we had to explain the context again and manually figure out where we were making mistakes. So we built ExamTwin: an AI-powered platform that turns your own study materials into realistic mock exams and uses data-driven analytics to identify weak areas and help you improve.</p>
          </div>
        </section>

        <section className={styles.team} aria-labelledby="team-heading">
          <div className={styles.teamIntro}>
            <p className={styles.sectionLabel}>The people behind ExamTwin</p>
            <h2 id="team-heading">Built together<br />in Vienna.</h2>
          </div>

          <div className={styles.cards}>
            <article className={styles.card}>
              <div className={`${styles.photo} ${styles.iliaPhoto}`}>
                <Image src="/team/ilia-malkin.png" alt="Ilia Malkin" fill sizes="(max-width: 760px) 100vw, 50vw" priority className={`${styles.image} ${styles.iliaImage}`} />
              </div>
              <p className={styles.role}>Frontend, UI/UX & motion</p>
              <h3>Ilia Malkin</h3>
              <p className={styles.bio}>Ilia is a coder and visual builder behind the frontend, UI/UX and video motion — making ExamTwin feel as clear and polished as it is useful.</p>
              <div className={styles.tags}>
                <span>WU Vienna</span>
                <span>Frontend</span>
                <span>UI/UX</span>
                <span>Video motion</span>
              </div>
              <div className={styles.links}>
                <a href="https://github.com/IliaMalkin/" target="_blank" rel="noreferrer">GitHub <Arrow /></a>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.photo}>
                <Image src="/team/bek-khazratov.jpg" alt="Bek Khazratov" fill sizes="(max-width: 760px) 100vw, 50vw" priority className={`${styles.image} ${styles.bekImage}`} />
              </div>
              <p className={styles.role}>Backend & data science</p>
              <h3>Bek Khazratov</h3>
              <p className={styles.bio}>Bek builds the backend, AI workflows and data-driven analytics that turn course material into realistic mock exams and useful signals for what to practise next.</p>
              <div className={styles.tags}>
                <span>TU Wien · Data Analytics</span>
                <span>Backend engineering</span>
                <span>AI workflows</span>
                <span>Data science</span>
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
