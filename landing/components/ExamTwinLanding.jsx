"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

/* =============================================================================
   ExamTwin — Landing page (canonical React component)
   Plain React 18. No CSS framework required — styling is inline + one injected
   <style> block for @font-face, @keyframes, hover states and responsive rules.
   Interactivity (live demo, adaptive engine, blueprint switcher, quiz arrows,
   FAQ, scroll reveals) is fully ported from the original prototype.
   ============================================================================= */

/* ---- tiny helper: turn a "a:b;c:d" CSS string into a React style object ---- */
function s(str) {
  const out = {};
  String(str).split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i === -1) return;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) return;
    const key = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = val;
  });
  return out;
}

const STYLES = `
:root{
  --paper:#efeee4; --paper-2:#e7e5d9; --ink:#0e0e0b; --ink-soft:#6b6a5f; --ink-dim:#93917f;
  --line:#dcd9cb; --line-strong:#c8c5b3;
  --violet:#4b39f7; --violet-deep:#3a2ae0; --violet-ink:#f4f3ff;
  --acid:#c5f43f; --acid-deep:#aee02c; --acid-ink:#12160a;
  --win:#141410; --win-2:#1c1c15; --win-3:#242419; --win-line:#2e2e24; --win-ink:#f3f2e8; --win-muted:#8f8e80; --win-dim:#63625a;
  --danger:#ff5a4d;
  --ease:cubic-bezier(0.22,1,0.36,1);
  --shadow:0 26px 64px rgba(14,14,11,.12);
  --shadow-win:0 40px 90px rgba(14,14,11,.30);
}
*{box-sizing:border-box}
.et-root{font-family:"Instrument Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.et-root a{color:var(--ink);text-decoration:none}
.et-root a:hover{color:var(--violet)}
.et-root h1,.et-root h2,.et-root h3{margin:0}
.et-root button{font-family:inherit;cursor:pointer;border:none;background:none}
.et-root ::selection{background:var(--acid);color:var(--acid-ink)}
.lbl{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:600}
[data-reveal]{opacity:0;transform:translateY(26px);transition:opacity .85s var(--ease),transform .85s var(--ease)}
[data-reveal].is-in{opacity:1;transform:none}
[data-d1]{transition-delay:.07s}[data-d2]{transition-delay:.14s}[data-d3]{transition-delay:.21s}[data-d4]{transition-delay:.28s}[data-d5]{transition-delay:.35s}
@keyframes tickerRun{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes floatA{0%,100%{transform:translateY(0) rotate(-3.5deg)}50%{transform:translateY(-12px) rotate(-3.5deg)}}
@keyframes floatB{0%,100%{transform:translateY(0) rotate(2.5deg)}50%{transform:translateY(-9px) rotate(2.5deg)}}
@keyframes floatC{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-15px) rotate(-1deg)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes swapIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes drawArrow{from{stroke-dashoffset:400}to{stroke-dashoffset:0}}
.qarrow{stroke-dasharray:400;animation:drawArrow .55s var(--ease) forwards}
.swap{animation:swapIn .45s var(--ease) both}
.blink{animation:blink 1.8s ease-in-out infinite}
.uline{position:relative}
.uline::after{content:"";position:absolute;left:0;bottom:-3px;height:2px;width:0;background:var(--violet);transition:width .3s var(--ease)}
.uline:hover::after{width:100%}
/* hover states (replace prototype's style-hover) */
.lift{transition:transform .25s var(--ease),box-shadow .25s var(--ease)}
.lift:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
.lift-border{transition:border-color .25s var(--ease),transform .25s var(--ease)}
.lift-border:hover{border-color:var(--ink);transform:translateY(-2px)}
.lift-white{transition:transform .25s var(--ease)}
.lift-white:hover{transform:translateY(-2px)}
.lift-final{transition:transform .25s var(--ease),box-shadow .25s var(--ease)}
.lift-final:hover{transform:translateY(-3px);box-shadow:0 22px 50px rgba(18,22,10,.28)}
.tap{transition:transform .2s var(--ease)}
.tap:hover{transform:translateY(-2px)}
.ghost-win{transition:border-color .2s var(--ease)}
.ghost-win:hover{border-color:var(--win-ink)}
.hcard{transition:transform .4s var(--ease),box-shadow .4s var(--ease)}
.hc1:hover{transform:rotate(-6deg) translateY(-12px) scale(1.03);box-shadow:0 34px 66px rgba(14,14,11,.22)}
.hc2:hover{transform:rotate(5deg) translateY(-12px) scale(1.03);box-shadow:0 36px 74px rgba(75,57,247,.36)}
.hc3:hover{transform:rotate(-2deg) translateY(-12px) scale(1.02);box-shadow:0 46px 96px rgba(14,14,11,.4)}
@media (max-width:980px){
  .hero-grid{grid-template-columns:1fr !important;gap:20px !important}
  .hero-cards{height:440px !important;margin-top:8px}
  .split{grid-template-columns:1fr !important;gap:18px !important}
  .cols-2{grid-template-columns:1fr !important}
  .engine-cols{grid-template-columns:1fr 1fr !important}
  .adapt-body{grid-template-columns:1fr !important}
  .bp-body{grid-template-columns:1fr !important}
  .compare-body{grid-template-columns:1fr !important}
  .nav-links{display:none !important}
  .foot-grid{grid-template-columns:1fr 1fr !important;gap:30px !important}
  .about-grid{grid-template-columns:1fr !important}
}
@media (max-width:600px){
  .engine-cols{grid-template-columns:1fr !important}
  .foot-grid{grid-template-columns:1fr !important}
  .hero-cards{height:400px !important}
}
@media (prefers-reduced-motion:reduce){
  [data-reveal]{opacity:1 !important;transform:none !important;transition:none !important}
  .floatA,.floatB,.floatC,.blink,.swap,.ticker-track{animation:none !important}
}
`;

/* ------------------------------ data ------------------------------ */
const TIMEBOXES = [25, 45, 100];

const QUESTIONS = [
  { tag: "Concepts · Q1 of 4", skill: "Concepts",
    prompt: "The time-independent Schrödinger equation is an eigenvalue equation for which operator?",
    opts: ["The position operator", "The Hamiltonian", "The momentum operator", "The parity operator"], correct: 1 },
  { tag: "Derivations · Q2 of 4", skill: "Derivations",
    prompt: "For a particle in a 1D infinite square well of width L, the energy levels scale with quantum number n as —",
    opts: ["n", "n²", "1 / n", "√n"], correct: 1 },
  { tag: "Applications · Q3 of 4", skill: "Applications",
    prompt: "The eigenvalues of the total angular-momentum operator L² are —",
    opts: ["ℏ · l", "ℏ² · l(l + 1)", "ℏ² · l²", "ℏ · m"], correct: 1 },
  { tag: "Perturbation · Q4 of 4", skill: "Perturbation",
    prompt: "In first-order perturbation theory, the energy correction to a state is —",
    opts: ["⟨ψ⁰| H′ |ψ⁰⟩", "⟨ψ⁰| H⁰ |ψ⁰⟩", "always exactly zero", "the sum of all |H′|²"], correct: 0 },
];

const ENGINE = [
  { n: "01", title: "Upload", glyph: "↑", desc: "Bring past papers, the rubric and the notes you trust.",
    label: "Context data / sources", meta: "3 sources · ready",
    rows: [
      { glyph: "📄", name: "Final exam 2024.pdf", meta: "Past exam · 2.4 MB", color: "var(--acid)" },
      { glyph: "📄", name: "Official formula sheet.pdf", meta: "Rubric · 680 KB", color: "var(--win-muted)" },
      { glyph: "📄", name: "Lecture notes — chapters 5–9.pdf", meta: "Notes · 8.1 MB", color: "var(--win-muted)" },
    ] },
  { n: "02", title: "Reconstruct", glyph: "▤", desc: "Map the parts, skills, timing and scoring.",
    label: "Exam blueprint / 3 parts", meta: "10 questions · 100 pts",
    rows: [
      { glyph: "◫", name: "Concepts · 8 questions", meta: "20 pts · 20 min", color: "var(--violet-ink)" },
      { glyph: "◫", name: "Derivations · 4 problems", meta: "40 pts · 45 min", color: "var(--violet-ink)" },
      { glyph: "◫", name: "Applications · 2 cases", meta: "40 pts · 35 min", color: "var(--violet-ink)" },
    ] },
  { n: "03", title: "Rehearse", glyph: "✦", desc: "Compile one mock for the time you have.",
    label: "Mock generation / compiled", meta: "100 min · 100 pts",
    rows: [
      { glyph: "▷", name: "Timed mock · 6 questions from the blueprint", meta: "100:00", color: "var(--acid)" },
      { glyph: "◎", name: "Allowed · formula sheet + non-programmable calc", meta: "rules", color: "var(--acid)" },
      { glyph: "✎", name: "Autosaves locally · pass mark 50%", meta: "on", color: "var(--win-muted)" },
    ] },
  { n: "04", title: "Adapt", glyph: "↻", desc: "Turn observed mistakes into the next mock.",
    label: "Adaptation / next", meta: "evidence-driven",
    rows: [
      { glyph: "↑", name: "Latest result 68% · readiness rising", meta: "improving", color: "var(--acid)" },
      { glyph: "◎", name: "Adaptive focus · operator methods + perturbation", meta: "target", color: "var(--acid)" },
      { glyph: "↻", name: "Compiled next · derivations coverage mock", meta: "queued", color: "var(--win-muted)" },
    ] },
];

const RUNS = [
  { code: "Mock 03", name: "Baseline", dday: "22 Jul", readiness: "61%", delta: "starting point",
    bars: [ { skill: "Concepts", val: 78 }, { skill: "Derivations", val: 52, weak: true }, { skill: "Applications", val: 66 }, { skill: "Perturbation", val: 58, weak: true } ],
    inspectTag: "Weakest signal · 52/100", inspectSkill: "Derivations", next: "45-minute derivations mock",
    why: "First simulation sets the evidence. Derivations is the widest gap against the rubric." },
  { code: "Mock 04", name: "Pressure check", dday: "2 Aug", readiness: "67%", delta: "+6 since baseline",
    bars: [ { skill: "Concepts", val: 84 }, { skill: "Derivations", val: 60, weak: true }, { skill: "Applications", val: 70 }, { skill: "Perturbation", val: 55, weak: true } ],
    inspectTag: "Inspecting · 55/100", inspectSkill: "Perturbation", next: "40-minute perturbation set",
    why: "Concepts are solid, but the timed mock exposed perturbation theory. Two signals now compete." },
  { code: "Mock 05", name: "Targeted retest", dday: "9 Aug", readiness: "68%", delta: "+7 since baseline",
    bars: [ { skill: "Concepts", val: 88 }, { skill: "Derivations", val: 66, weak: true }, { skill: "Applications", val: 74 }, { skill: "Perturbation", val: 63, weak: true } ],
    inspectTag: "Inspecting Mock 05 · 66/100", inspectSkill: "Derivations", next: "Operator methods & perturbation mock",
    why: "Derivations recovered points. Perturbation is now the limiting signal, so the next mock changes again." },
];

const BLUEPRINTS = [
  { cat: "STEM · PHY-401", name: "Final exam 2025", run: "100m", title: "Operator methods & perturbation", target: "3 parts · 100 pts", exam: "Quantum Physics · Final 2025", dday: "12 Aug" },
  { cat: "STEM · PHY-401", name: "Midterm 2025", run: "60m", title: "Wave mechanics core", target: "2 parts · 60 pts", exam: "Quantum Physics · Midterm", dday: "29 Jul" },
  { cat: "CS · CS-301", name: "Algorithms final", run: "120m", title: "Graphs & complexity proofs", target: "3 parts · 120 pts", exam: "Algorithms & Data Structures", dday: "4 Sep" },
  { cat: "Language · ÖSD", name: "German C1", run: "45m", title: "ÖSD writing task 2", target: "C1 band rubric", exam: "German C1 · ÖSD", dday: "—" },
];

const FAQ = [
  { q: "Is this another AI quiz generator?", a: "No. ExamTwin first reconstructs and verifies the exam blueprint. Questions are generated only inside a timed rehearsal chosen for a specific evidence goal." },
  { q: "What should I upload?", a: "Past papers, the official rubric or syllabus, and your own notes. The more faithful your source material, the closer the reconstructed exam is to the real thing." },
  { q: "Can I use it if I only have 25 minutes?", a: "Yes — that's the point. You tell ExamTwin the timebox you actually have today, and it compiles the single highest-value rehearsal that fits it." },
  { q: "Does the next test really change?", a: "Every attempt updates the evidence: which skills are weak, how close the exam is, and where you lose points. The next rehearsal is recompiled from that, not repeated." },
  { q: "Who is building ExamTwin?", a: "A small team of students in Vienna. We started it at OpenAI Build Week 2026 because it's the study tool we needed ourselves." },
];

const TICKER = ["Quantum Physics","Organic Chemistry","Linear Algebra","Constitutional Law","Microeconomics","Human Anatomy","Algorithms","Thermodynamics","Macroeconomics","Statistics","Contract Law","Molecular Biology"];
const QUIZWORDS = ["Wave functions", "Operators", "Angular momentum", "Perturbation theory", "Spin & statistics"];

/* ------------------------------ component ------------------------------ */
export default function ExamTwinLanding({ accent = "#c5f43f", grid = true, motion = true }) {
  const [demoStep, setDemoStep] = useState(0);
  const [tb, setTb] = useState(1);
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [engine, setEngine] = useState(0);
  const [run, setRun] = useState(2);
  const [skill, setSkill] = useState(2);
  const [bp, setBp] = useState(0);
  const [faq, setFaq] = useState(0);
  const [adaptIn, setAdaptIn] = useState(false);
  const [qcur, setQcur] = useState(-1);
  const [qArrows, setQArrows] = useState([]);

  const rootRef = useRef(null);
  const qrevRef = useRef([]);

  /* scroll reveals + adapt bar trigger
     (scroll/interval driven — resilient across environments where
      IntersectionObserver callbacks are unreliable, e.g. sandboxed iframes) */
  useEffect(() => {
    const scope = rootRef.current;
    if (!scope) return;
    const els = Array.from(scope.querySelectorAll("[data-reveal]"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!motion || reduce) {
      els.forEach((el) => el.classList.add("is-in"));
      setAdaptIn(true);
      return;
    }
    let pending = els.slice();
    let adaptDone = false;
    const adaptEl = scope.querySelector("#adapt");
    const check = () => {
      const vh = window.innerHeight || 800;
      pending = pending.filter((el) => {
        if (el.getBoundingClientRect().top < vh * 0.88) { el.classList.add("is-in"); return false; }
        return true;
      });
      if (!adaptDone && adaptEl && adaptEl.getBoundingClientRect().top < vh) { adaptDone = true; setAdaptIn(true); }
      if (!pending.length && adaptDone) cleanup();
    };
    const onScroll = () => check();
    const id = setInterval(check, 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const cleanup = () => {
      clearInterval(id);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    check();
    return cleanup;
  }, [motion]);

  /* quiz scatter interactions */
  const recomputeArrows = useCallback(() => {
    const scat = rootRef.current && rootRef.current.querySelector("#compare .quiz-scatter");
    if (!scat) return;
    const cr = scat.getBoundingClientRect();
    const rects = {};
    scat.querySelectorAll(".qcard").forEach((el) => { rects[el.getAttribute("data-i")] = el.getBoundingClientRect(); });
    const qrev = qrevRef.current;
    const arr = [];
    const build = (a, b, idx) => {
      let x1 = a.left + a.width / 2 - cr.left, y1 = a.top + a.height / 2 - cr.top;
      let x2 = b.left + b.width / 2 - cr.left, y2 = b.top + b.height / 2 - cr.top;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      x1 += ux * (a.width / 2 + 4); y1 += uy * (a.height / 2 + 4);
      x2 -= ux * (b.width / 2 + 9); y2 -= uy * (b.height / 2 + 9);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const off = (idx % 2 ? 1 : -1) * Math.min(40, len * 0.32);
      const cx = mx - uy * off, cy = my + ux * off;
      const ang = Math.atan2(y2 - cy, x2 - cx), hl = 11, sp = 0.5;
      const h1x = x2 - hl * Math.cos(ang - sp), h1y = y2 - hl * Math.sin(ang - sp);
      const h2x = x2 - hl * Math.cos(ang + sp), h2y = y2 - hl * Math.sin(ang + sp);
      const f = (n) => n.toFixed(1);
      return `M ${f(x1)} ${f(y1)} Q ${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)} M ${f(x2)} ${f(y2)} L ${f(h1x)} ${f(h1y)} M ${f(x2)} ${f(y2)} L ${f(h2x)} ${f(h2y)}`;
    };
    for (let k = 1; k < qrev.length; k++) {
      const a = rects[qrev[k - 1]], b = rects[qrev[k]];
      if (a && b) arr.push({ d: build(a, b, k) });
    }
    setQArrows(arr);
  }, []);

  const qEnter = (i) => () => {
    if (qrevRef.current.indexOf(i) === -1) qrevRef.current = qrevRef.current.concat(i);
    setQcur(i);
    setTimeout(recomputeArrows, 40);
  };
  const resetQuiz = () => { qrevRef.current = []; setQcur(-1); setQArrows([]); };

  const pick = (i) => () => { if (answered) return; setSel(i); };
  const startMock = () => { setDemoStep(1); setQi(0); setSel(null); setAnswered(false); setResults([]); };
  const demoNext = () => {
    if (sel === null && !answered) return;
    if (!answered) { const ok = sel === QUESTIONS[qi].correct; setAnswered(true); setResults((r) => [...r, ok]); return; }
    if (qi < QUESTIONS.length - 1) { setQi(qi + 1); setSel(null); setAnswered(false); }
    else setDemoStep(2);
  };
  const demoRestart = () => { setDemoStep(0); setQi(0); setSel(null); setAnswered(false); setResults([]); };

  /* ---------------- derived values (was renderVals) ---------------- */
  const gridDisplay = grid ? "block" : "none";
  const tickerText = TICKER.concat(TICKER).join("      ·      ");

  const stepNames = ["Choose run", "Take a 4-question mock", "Get your diagnosis"];
  const demoMin = TIMEBOXES[tb];
  const demoClock = `${String(TIMEBOXES[tb]).padStart(2, "0")}:00`;

  const q = QUESTIONS[qi];
  const demoProgress = `${((qi + (answered ? 1 : 0)) / QUESTIONS.length) * 100}%`;
  const demoHint = answered
    ? (sel === q.correct ? "Correct — logged as evidence." : "Noted — this becomes your evidence target.")
    : "Pick an answer to lock it in.";
  const demoNextLabel = !answered ? "Check answer" : (qi < QUESTIONS.length - 1 ? "Next question" : "See diagnosis");
  const canNext = answered || sel !== null;
  const demoNextStyle = `display:inline-flex;align-items:center;gap:9px;padding:12px 22px;border-radius:11px;font-weight:700;font-size:15px;transition:all .2s var(--ease);${canNext ? "background:var(--acid);color:var(--acid-ink)" : "background:var(--win-3);color:var(--win-dim);cursor:not-allowed"}`;

  const right = results.filter(Boolean).length, total = QUESTIONS.length;
  const pct = Math.round((right / total) * 100);
  const demoScoreColor = pct >= 75 ? "var(--acid)" : pct >= 50 ? "var(--win-ink)" : "var(--danger)";
  const missed = QUESTIONS.filter((_, i) => results[i] === false).map((x) => x.skill);
  const demoVerdict = missed.length === 0
    ? "Clean run. Evidence says you're ready — ExamTwin queues a timed full-length to confirm under pressure."
    : `You lost points on ${missed.slice(0, 2).join(" & ")}. That becomes the evidence target for your next rehearsal.`;
  const demoNextRun = missed.length ? `${demoMin}-minute ${missed[0].toLowerCase()} coverage mock` : `${demoMin}-minute full-length confirm`;

  const eng = ENGINE[engine];
  const runObj = RUNS[run];
  const selBar = runObj.bars[skill] || runObj.bars[0];
  const bpObj = BLUEPRINTS[bp];

  const rots = [-12, 8, -6, 11, -3], lefts = [2, 34, 14, 55, 40], tops = [8, 0, 96, 78, 34];

  return (
    <div ref={rootRef} className="et-root" style={{ "--acid": accent, position: "relative", background: "var(--paper)", color: "var(--ink)", minHeight: "100vh", overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div aria-hidden="true" style={s(`position:absolute;inset:0;display:${gridDisplay};pointer-events:none;z-index:0;background-image:linear-gradient(rgba(14,14,11,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(14,14,11,.04) 1px,transparent 1px);background-size:78px 78px`)}></div>

      <div style={s("position:relative;z-index:1")}>

        {/* NAV */}
        <header style={s("position:sticky;top:0;z-index:80;backdrop-filter:blur(12px);background:rgba(239,238,228,.8);border-bottom:1px solid var(--line)")}>
          <nav style={s("max-width:1240px;margin:0 auto;padding:15px clamp(18px,4vw,60px);display:flex;align-items:center;justify-content:space-between;gap:24px")}>
            <a href="#top" style={s("display:flex;align-items:center;gap:11px;font-weight:700;font-size:20px;letter-spacing:-.02em")}>
              <span style={s("display:grid;place-items:center;width:30px;height:30px")}>
                <span style={s("width:26px;height:26px;border-radius:50%;border:2.5px solid var(--acid-deep);display:grid;place-items:center")}><span style={s("width:13px;height:13px;border-radius:50%;border:2.5px solid var(--acid-deep)")}><span style={s("display:block;width:3px;height:3px;margin:2px auto;border-radius:50%;background:var(--acid-deep)")}></span></span></span>
              </span>
              ExamTwin
            </a>
            <div className="nav-links" style={s("display:flex;align-items:center;gap:30px;font-size:15px;font-weight:500;color:var(--ink)")}>
              <a href="#process" className="uline" style={s("color:inherit")}>How it works</a>
              <a href="#engine" className="uline" style={s("color:inherit")}>Product</a>
              <a href="#adapt" className="uline" style={s("color:inherit")}>Results</a>
              <a href="/about" className="uline" style={s("color:inherit")}>About us</a>
              <a href="#demo" className="uline" style={s("color:inherit")}>Log in</a>
            </div>
            <a href="#cta" className="lift" style={s("display:inline-flex;align-items:center;gap:9px;padding:11px 20px;background:var(--ink);color:var(--paper);font-weight:600;font-size:15px;border-radius:11px")}>Start free <span style={s("color:var(--acid)")}>→</span></a>
          </nav>
        </header>

        {/* HERO */}
        <section id="top" style={s("max-width:1240px;margin:0 auto;padding:clamp(48px,6vw,88px) clamp(18px,4vw,60px) clamp(32px,4vw,56px)")}>
          <div className="hero-grid" style={s("display:grid;grid-template-columns:1.02fr .98fr;gap:48px;align-items:center")}>
            <div>
              <div data-reveal style={s("display:inline-flex;align-items:center;gap:9px;background:#fff;border:1px solid var(--line-strong);border-radius:999px;padding:8px 15px;margin-bottom:28px")}>
                <span style={s("color:var(--violet);font-size:14px")}>✦</span>
                <span className="lbl" style={s("color:var(--ink-soft);letter-spacing:.13em")}>The exam runtime / built from your materials</span>
              </div>
              <h1 data-reveal data-d1 style={s("font-size:clamp(44px,6.6vw,86px);line-height:.94;letter-spacing:-.045em;font-weight:700;margin:0 0 26px;text-wrap:balance")}>Stop studying everything.<br /><span style={s("color:var(--violet)")}>Rehearse what matters next.</span></h1>
              <p data-reveal data-d2 style={s("font-size:clamp(17px,1.55vw,19px);line-height:1.55;color:var(--ink-soft);max-width:46ch;margin:0 0 32px;text-wrap:pretty")}>Upload past papers, the rubric and your notes. ExamTwin reconstructs the real exam and compiles the highest-value timed rehearsal for the time you have today.</p>
              <div data-reveal data-d3 style={s("display:flex;flex-wrap:wrap;gap:13px;margin-bottom:30px")}>
                <a href="#cta" className="lift" style={s("display:inline-flex;align-items:center;gap:10px;padding:15px 26px;background:var(--ink);color:var(--paper);font-weight:600;font-size:16px;border-radius:13px")}>Build my exam twin <span style={s("color:var(--acid)")}>→</span></a>
                <a href="#demo" className="lift-border" style={s("display:inline-flex;align-items:center;padding:15px 24px;background:#fff;border:1px solid var(--line-strong);color:var(--ink);font-weight:600;font-size:16px;border-radius:13px")}>See it compile</a>
              </div>
            </div>

            {/* hero card stack */}
            <div className="hero-cards" data-reveal data-d2 style={s("position:relative;height:472px;width:100%;max-width:500px;margin:0 auto")}>
              <div className="hcard hc1" style={s("position:absolute;top:4px;left:1%;width:min(284px,60%);background:var(--acid);color:var(--acid-ink);border-radius:22px;padding:22px 24px;z-index:1;box-shadow:0 16px 40px rgba(14,14,11,.10);transform:rotate(-6deg)")}>
                <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:16px")}><span className="lbl" style={s("opacity:.6;letter-spacing:.13em")}>Materials in</span><span className="lbl" style={s("opacity:.6")}>01</span></div>
                <div style={s("display:flex;flex-direction:column;gap:8px")}>
                  <div style={s("display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600")}><span>📄</span>Final exam 2024.pdf</div>
                  <div style={s("display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600")}><span>📄</span>Official formula sheet.pdf</div>
                  <div style={s("display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600")}><span>📄</span>Lecture notes 5–9.pdf</div>
                </div>
                <div style={s("margin-top:15px;padding-top:12px;border-top:1px solid rgba(18,22,10,.18);font-size:12.5px;font-weight:700;letter-spacing:.01em")}>→ Verified blueprint · 3 parts · 100 pts</div>
              </div>
              <div className="hcard hc2" style={s("position:absolute;top:88px;right:0;width:min(302px,64%);background:var(--violet);color:var(--violet-ink);border-radius:24px;padding:24px;z-index:2;box-shadow:0 18px 46px rgba(75,57,247,.2);transform:rotate(5deg)")}>
                <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px")}><span className="lbl" style={s("opacity:.72;letter-spacing:.13em")}>Your exam</span><span className="lbl" style={s("opacity:.6")}>02</span></div>
                <div style={s("display:flex;align-items:baseline;gap:10px;margin-top:8px")}><span style={s("font-size:64px;font-weight:700;line-height:.82;letter-spacing:-.05em")}>29</span><span style={s("font-size:24px;font-weight:600;letter-spacing:-.02em")}>days left</span></div>
                <div style={s("margin-top:14px;font-size:14px;opacity:.85")}>Quantum Physics · Final 2025 · 12 Aug</div>
                <div style={s("margin-top:16px;height:6px;border-radius:99px;background:rgba(255,255,255,.22);overflow:hidden")}><div style={s("width:68%;height:100%;background:var(--acid)")}></div></div>
                <div className="lbl" style={s("display:flex;justify-content:space-between;margin-top:9px;opacity:.72")}><span>Readiness 68%</span><span>3 mocks done</span></div>
              </div>
              <div className="hcard hc3" style={s("position:absolute;bottom:0;left:3%;width:min(408px,86%);background:var(--win);color:var(--win-ink);border-radius:22px;padding:24px 24px 22px;z-index:3;box-shadow:0 26px 64px rgba(14,14,11,.24);transform:rotate(-2deg)")}>
                <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:18px")}>
                  <span className="lbl" style={s("color:var(--win-muted);letter-spacing:.13em")}>Compiled next · 03</span>
                  <span style={s("display:inline-flex;align-items:center;gap:7px;color:var(--acid)")} className="lbl"><span className="blink" style={s("width:7px;height:7px;border-radius:50%;background:var(--acid)")}></span>Live</span>
                </div>
                <div style={s("font-size:28px;font-weight:700;letter-spacing:-.03em;line-height:1.05")}>Operator methods &amp; perturbation</div>
                <div style={s("margin-top:12px;font-size:14px;color:var(--win-muted)")}>Boosts derivations coverage · keeps 100-min structure</div>
                <div style={s("height:1px;background:var(--win-line);margin:18px 0 15px")}></div>
                <div className="lbl" style={s("color:var(--win-dim);letter-spacing:.13em;margin-bottom:11px")}>Time available today</div>
                <div style={s("display:flex;gap:9px")}>
                  <div style={s("flex:1;text-align:center;padding:11px 0;border-radius:11px;background:var(--win-2);border:1px solid var(--win-line);font-weight:600;font-size:15px;color:var(--win-muted)")}>25m</div>
                  <div style={s("flex:1;text-align:center;padding:11px 0;border-radius:11px;background:var(--acid);color:var(--acid-ink);font-weight:700;font-size:15px")}>45m</div>
                  <div style={s("flex:1;text-align:center;padding:11px 0;border-radius:11px;background:var(--win-2);border:1px solid var(--win-line);font-weight:600;font-size:15px;color:var(--win-muted)")}>100m</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TICKER */}
        <div style={s("border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--paper-2)")}>
          <div style={s("max-width:1240px;margin:0 auto;display:flex;align-items:stretch")}>
            <span className="lbl" style={s("flex-shrink:0;display:flex;align-items:center;gap:9px;padding:0 22px 0 clamp(18px,4vw,60px);color:var(--violet);letter-spacing:.15em;white-space:nowrap;border-right:1px solid var(--line)")}><span style={s("width:7px;height:7px;border-radius:50%;background:var(--acid);box-shadow:0 0 0 3px rgba(197,244,63,.28)")}></span>Reconstructed from real exams</span>
            <div style={s("flex:1;overflow:hidden;padding:14px 0;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 7%,#000 93%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 7%,#000 93%,transparent 100%)")}>
              <div className="ticker-track" style={s("display:flex;gap:38px;white-space:nowrap;animation:tickerRun 54s linear infinite;font-size:12.5px;font-weight:500;letter-spacing:.09em;color:var(--ink-dim);padding-left:38px")}>{tickerText}</div>
            </div>
          </div>
        </div>

        {/* 01 · RUN THE PROOF */}
        <section id="demo" style={s("max-width:1240px;margin:0 auto;padding:clamp(40px,5vw,76px) clamp(18px,4vw,60px) clamp(28px,3vw,48px)")}>
          <div className="split" data-reveal style={s("display:grid;grid-template-columns:1.25fr 1fr;gap:40px;align-items:end;margin-bottom:40px")}>
            <div>
              <span style={s("display:inline-block;background:var(--acid);color:var(--acid-ink);border-radius:999px;padding:7px 15px;margin-bottom:22px")} className="lbl">01 / Run the proof</span>
              <h2 style={s("font-size:clamp(32px,4.4vw,58px);line-height:.98;letter-spacing:-.035em;font-weight:700")}>Take a real mini-mock.<br />Get a real diagnosis.</h2>
            </div>
            <p style={s("border-left:3px solid var(--violet);padding-left:20px;font-size:clamp(17px,1.5vw,20px);line-height:1.4;color:var(--ink);margin:0;max-width:36ch")}>Four questions. One scored diagnosis. Then the next rehearsal recompiles.</p>
          </div>

          <div data-reveal data-d1 style={s("background:var(--win);color:var(--win-ink);border-radius:20px;box-shadow:var(--shadow-win);overflow:hidden")}>
            <div style={s("display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--win-2);border-bottom:1px solid var(--win-line)")}>
              <div style={s("display:flex;align-items:center;gap:9px")}>
                <span style={s("width:12px;height:12px;border-radius:50%;background:#ff5f57")}></span><span style={s("width:12px;height:12px;border-radius:50%;background:#febc2e")}></span><span style={s("width:12px;height:12px;border-radius:50%;background:#28c840")}></span>
                <span className="lbl" style={s("margin-left:10px;color:var(--win-muted);letter-spacing:.12em")}>Live product preview</span>
              </div>
              <span className="lbl" style={s("display:inline-flex;align-items:center;gap:7px;color:var(--win-muted)")}><span className="blink" style={s("width:7px;height:7px;border-radius:50%;background:var(--acid)")}></span>No sign-up</span>
            </div>
            <div style={s("display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--win-line)")}>
              {stepNames.map((label, i) => {
                const active = i === demoStep, done = i < demoStep;
                return (
                  <div key={i} style={s(`display:flex;align-items:center;gap:12px;padding:16px 20px;border-right:${i < 2 ? "1px solid var(--win-line)" : "none"};border-bottom:3px solid ${active ? "var(--acid)" : "transparent"}`)}>
                    <span style={s(`display:grid;place-items:center;width:24px;height:24px;border-radius:50%;font-size:12px;font-weight:700;${active || done ? "background:var(--acid);color:var(--acid-ink)" : "border:1px solid var(--win-line);color:var(--win-dim)"}`)}>{done ? "✓" : String(i + 1)}</span>
                    <span style={s(`font-weight:600;font-size:14.5px;color:${active ? "var(--win-ink)" : "var(--win-dim)"}`)}>{label}</span>
                  </div>
                );
              })}
            </div>

            {demoStep === 0 && (
              <div className="engine-cols swap" style={s("display:grid;grid-template-columns:.85fr 1.15fr;gap:0")}>
                <div style={s("padding:clamp(22px,3vw,38px);border-right:1px solid var(--win-line)")}>
                  <div className="lbl" style={s("color:var(--acid);letter-spacing:.12em;margin-bottom:20px")}>✦ Quantum Physics · Final 2025</div>
                  <h3 style={s("font-size:clamp(26px,2.6vw,34px);line-height:1.02;letter-spacing:-.03em;font-weight:700;margin-bottom:26px")}>How much time do you have today?</h3>
                  <div style={s("display:flex;gap:12px")}>
                    {TIMEBOXES.map((min, i) => {
                      const on = i === tb;
                      return (
                        <button key={i} onClick={() => setTb(i)} style={s(`flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:20px 0;border-radius:14px;transition:all .2s var(--ease);${on ? "background:var(--acid);color:var(--acid-ink)" : "background:var(--win-2);border:1px solid var(--win-line);color:var(--win-muted)"}`)}>
                          <span style={s("font-size:30px;font-weight:700;letter-spacing:-.03em")}>{min}</span>
                          <span className="lbl" style={s("opacity:.6;letter-spacing:.14em")}>min</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={s("padding:clamp(22px,3vw,38px)")}>
                  <div style={s("display:flex;align-items:flex-start;justify-content:space-between;gap:14px")}>
                    <span className="lbl" style={s("color:var(--win-dim);letter-spacing:.12em")}>Mock 06 · compiled</span>
                    <span style={s("font-size:26px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums")}>{demoClock}</span>
                  </div>
                  <h3 style={s("font-size:clamp(28px,3vw,40px);line-height:1;letter-spacing:-.035em;font-weight:700;margin:14px 0 14px")}>Operator methods under pressure</h3>
                  <p style={s("font-size:15px;line-height:1.5;color:var(--win-muted);max-width:52ch;margin:0 0 18px")}>Take a real four-question slice. ExamTwin scores it, explains every answer and compiles what you should rehearse next.</p>
                  <div style={s("display:flex;flex-wrap:wrap;gap:9px;margin-bottom:20px")}>
                    <span style={s("border:1px solid var(--win-line);border-radius:999px;padding:7px 13px;font-size:13px;font-weight:500;color:var(--win-muted)")}>4-question live demo</span>
                    <span style={s("border:1px solid var(--win-line);border-radius:999px;padding:7px 13px;font-size:13px;font-weight:500;color:var(--win-muted)")}>3 worked problems</span>
                    <span style={s("border:1px solid var(--win-line);border-radius:999px;padding:7px 13px;font-size:13px;font-weight:500;color:var(--win-muted)")}>Instant diagnosis</span>
                  </div>
                  <div style={s("display:flex;align-items:center;gap:12px;background:rgba(197,244,63,.1);border:1px solid rgba(197,244,63,.35);border-radius:13px;padding:14px 16px;margin-bottom:20px")}>
                    <span style={s("color:var(--acid);font-size:18px")}>◎</span>
                    <div><div className="lbl" style={s("color:var(--acid);letter-spacing:.1em;margin-bottom:3px")}>Evidence target</div><div style={s("font-size:14.5px;font-weight:600")}>Lift derivations coverage before 12 Aug</div></div>
                  </div>
                  <button onClick={startMock} className="tap" style={s("display:inline-flex;align-items:center;gap:10px;background:var(--acid);color:var(--acid-ink);font-weight:700;font-size:15.5px;padding:14px 24px;border-radius:12px")}>Start the {demoMin}-min mock <span>→</span></button>
                </div>
              </div>
            )}

            {demoStep === 1 && (
              <div className="swap" style={s("padding:clamp(22px,3vw,40px)")}>
                <div style={s("display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:8px")}>
                  <span className="lbl" style={s("color:var(--acid);letter-spacing:.12em")}>{q.tag}</span>
                  <span style={s("font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--win-muted)")}>{demoClock}</span>
                </div>
                <div style={s("height:5px;border-radius:99px;background:var(--win-line);overflow:hidden;margin-bottom:24px")}><div style={s(`width:${demoProgress};height:100%;background:var(--acid);transition:width .4s var(--ease)`)}></div></div>
                <h3 style={s("font-size:clamp(22px,2.3vw,30px);line-height:1.15;letter-spacing:-.02em;font-weight:600;max-width:32ch;margin-bottom:24px")}>{q.prompt}</h3>
                <div style={s("display:flex;flex-direction:column;gap:11px;max-width:640px")}>
                  {q.opts.map((text, i) => {
                    let bg = "var(--win-2)", bd = "var(--win-line)", mark = "", markColor = "transparent", keyBg = "var(--win-3)", keyColor = "var(--win-muted)";
                    if (!answered && sel === i) { bd = "var(--acid)"; bg = "rgba(197,244,63,.08)"; keyBg = "var(--acid)"; keyColor = "var(--acid-ink)"; }
                    if (answered) {
                      if (i === q.correct) { bd = "var(--acid)"; bg = "rgba(197,244,63,.12)"; mark = "✓"; markColor = "var(--acid)"; keyBg = "var(--acid)"; keyColor = "var(--acid-ink)"; }
                      else if (i === sel) { bd = "var(--danger)"; bg = "rgba(255,90,77,.1)"; mark = "✗"; markColor = "var(--danger)"; keyBg = "var(--danger)"; keyColor = "#fff"; }
                    }
                    return (
                      <button key={i} onClick={pick(i)} style={s(`display:flex;align-items:center;gap:14px;padding:15px 16px;border-radius:13px;border:1.5px solid ${bd};background:${bg};color:var(--win-ink);transition:all .18s var(--ease);cursor:${answered ? "default" : "pointer"}`)}>
                        <span style={s(`display:grid;place-items:center;width:28px;height:28px;border-radius:8px;font-size:13px;font-weight:700;background:${keyBg};color:${keyColor}`)}>{"ABCD"[i]}</span>
                        <span style={s("flex:1;text-align:left;font-size:16px;font-weight:500")}>{text}</span>
                        <span style={s(`font-size:16px;color:${markColor}`)}>{mark}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={s("display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:26px")}>
                  <span style={s("font-size:13.5px;color:var(--win-dim)")}>{demoHint}</span>
                  <button onClick={demoNext} style={s(demoNextStyle)}>{demoNextLabel} <span>→</span></button>
                </div>
              </div>
            )}

            {demoStep === 2 && (
              <div className="adapt-body swap" style={s("display:grid;grid-template-columns:.9fr 1.1fr;gap:0")}>
                <div style={s("padding:clamp(22px,3vw,38px);border-right:1px solid var(--win-line)")}>
                  <div className="lbl" style={s("color:var(--win-dim);letter-spacing:.12em;margin-bottom:14px")}>Your diagnosis</div>
                  <div style={s("display:flex;align-items:baseline;gap:12px")}><span style={s(`font-size:64px;font-weight:700;line-height:.85;letter-spacing:-.04em;color:${demoScoreColor}`)}>{pct}%</span><span style={s("font-size:17px;color:var(--win-muted)")}>{`${right}/${total} correct · ${right * 6}/24 pts`}</span></div>
                  <p style={s("font-size:14.5px;line-height:1.55;color:var(--win-muted);margin:20px 0 24px;max-width:40ch")}>{demoVerdict}</p>
                  <button onClick={demoRestart} className="ghost-win" style={s("display:inline-flex;align-items:center;gap:9px;border:1px solid var(--win-line);color:var(--win-ink);font-weight:600;font-size:14.5px;padding:11px 18px;border-radius:11px")}><span>↻</span> Run it again</button>
                </div>
                <div style={s("padding:clamp(22px,3vw,38px)")}>
                  <div className="lbl" style={s("color:var(--win-dim);letter-spacing:.12em;margin-bottom:18px")}>Skill evidence</div>
                  <div style={s("display:flex;flex-direction:column;gap:15px")}>
                    {QUESTIONS.map((x, i) => {
                      const ok = results[i]; const val = ok ? (78 + i * 4) : (38 + i * 3);
                      return (
                        <div key={i}>
                          <div style={s("display:flex;justify-content:space-between;font-size:14px;font-weight:500;margin-bottom:6px")}><span>{x.skill}</span><span style={s("color:var(--win-muted);font-variant-numeric:tabular-nums")}>{val}</span></div>
                          <div style={s("height:7px;border-radius:99px;background:var(--win-line);overflow:hidden")}><div style={s(`width:${val}%;height:100%;border-radius:99px;background:${ok ? "var(--acid)" : "var(--danger)"};transition:width .7s var(--ease)`)}></div></div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={s("display:flex;align-items:center;gap:12px;background:var(--acid);color:var(--acid-ink);border-radius:13px;padding:15px 17px;margin-top:24px")}>
                    <span style={s("font-size:18px")}>◎</span>
                    <div><div className="lbl" style={s("letter-spacing:.1em;opacity:.7;margin-bottom:2px")}>Compiled next</div><div style={s("font-size:15.5px;font-weight:700")}>{demoNextRun}</div></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 02 · SEE THE ENGINE */}
        <section id="engine" style={s("max-width:1240px;margin:0 auto;padding:clamp(40px,5vw,76px) clamp(18px,4vw,60px) clamp(28px,3vw,48px)")}>
          <div className="split" data-reveal style={s("display:grid;grid-template-columns:1.25fr 1fr;gap:40px;align-items:end;margin-bottom:40px")}>
            <div>
              <span style={s("display:inline-block;background:var(--acid);color:var(--acid-ink);border-radius:999px;padding:7px 15px;margin-bottom:22px")} className="lbl">02 / See the engine</span>
              <h2 style={s("font-size:clamp(32px,4.4vw,58px);line-height:.98;letter-spacing:-.035em;font-weight:700")}>From your files to<br />the next right rehearsal.</h2>
            </div>
            <p style={s("border-left:3px solid var(--violet);padding-left:20px;font-size:clamp(16px,1.4vw,19px);line-height:1.45;color:var(--ink);margin:0;max-width:36ch")}>Your materials become an exam blueprint. Every attempt changes what the engine builds next.</p>
          </div>

          <div data-reveal data-d1 style={s("background:var(--win);color:var(--win-ink);border-radius:20px;box-shadow:var(--shadow-win);overflow:hidden")}>
            <div style={s("display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--win-2);border-bottom:1px solid var(--win-line)")}>
              <div style={s("display:flex;align-items:center;gap:9px")}>
                <span style={s("width:12px;height:12px;border-radius:50%;background:#ff5f57")}></span><span style={s("width:12px;height:12px;border-radius:50%;background:#febc2e")}></span><span style={s("width:12px;height:12px;border-radius:50%;background:#28c840")}></span>
                <span className="lbl" style={s("margin-left:10px;color:var(--win-muted);letter-spacing:.12em")}>ExamTwin / adaptive engine</span>
              </div>
              <span className="lbl" style={s("display:inline-flex;align-items:center;gap:7px;color:var(--win-muted)")}><span className="blink" style={s("width:7px;height:7px;border-radius:50%;background:var(--acid)")}></span>Live product flow</span>
            </div>
            <div className="engine-cols" style={s("display:grid;grid-template-columns:repeat(4,1fr)")}>
              {ENGINE.map((e, i) => {
                const on = i === engine;
                return (
                  <button key={i} onClick={() => setEngine(i)} style={s(`display:flex;flex-direction:column;padding:clamp(18px,2.2vw,28px);border-right:${i < 3 ? "1px solid var(--win-line)" : "none"};background:${on ? "var(--win-2)" : "transparent"};transition:background .25s var(--ease);cursor:pointer`)}>
                    <div style={s("display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:52px")}>
                      <span className="lbl" style={s("color:var(--win-dim);letter-spacing:.12em")}>{e.n}</span>
                      <span style={s(`display:grid;place-items:center;width:40px;height:40px;border-radius:11px;font-size:18px;${on ? "background:var(--acid);color:var(--acid-ink)" : "background:var(--win-3);color:var(--win-muted)"}`)}>{e.glyph}</span>
                    </div>
                    <div style={s("font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:9px;text-align:left")}>{e.title}</div>
                    <div style={s("font-size:14px;line-height:1.5;color:var(--win-muted);text-align:left")}>{e.desc}</div>
                    <div style={s(`height:2px;margin-top:20px;border-radius:2px;background:${on ? "var(--acid)" : "var(--win-line)"};transition:background .3s var(--ease)`)}></div>
                  </button>
                );
              })}
            </div>
            <div style={s("padding:clamp(20px,2.6vw,32px);border-top:1px solid var(--win-line);background:var(--win-2)")}>
              <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:16px")}>
                <span className="lbl" style={s("color:var(--win-dim);letter-spacing:.12em")}>{eng.label}</span>
                <span className="lbl" style={s("color:var(--win-muted)")}>{eng.meta}</span>
              </div>
              <div className="swap" style={s("display:flex;flex-direction:column;gap:9px")}>
                {eng.rows.map((a, i) => (
                  <div key={i} style={s("display:flex;align-items:center;gap:12px;padding:13px 15px;background:var(--win);border:1px solid var(--win-line);border-radius:12px")}>
                    <span style={s(`color:${a.color};font-size:15px`)}>{a.glyph}</span>
                    <span style={s("flex:1;font-size:14.5px;font-weight:500")}>{a.name}</span>
                    <span style={s("font-size:12.5px;color:var(--win-dim)")}>{a.meta}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 03 · WATCH IT ADAPT */}
        <section id="adapt" style={s("max-width:1240px;margin:0 auto;padding:clamp(40px,5vw,76px) clamp(18px,4vw,60px) clamp(28px,3vw,48px)")}>
          <div className="split" style={s("display:grid;grid-template-columns:.95fr 1.05fr;gap:48px;align-items:center")}>
            <div data-reveal>
              <span style={s("display:inline-block;background:var(--acid);color:var(--acid-ink);border-radius:999px;padding:7px 15px;margin-bottom:22px")} className="lbl">03 · Watch it adapt</span>
              <h2 style={s("font-size:clamp(34px,4.6vw,62px);line-height:.96;letter-spacing:-.035em;font-weight:700;margin-bottom:22px")}>One weak skill can change the whole plan.</h2>
              <p style={s("font-size:clamp(16px,1.4vw,18px);line-height:1.55;color:var(--ink-soft);max-width:44ch;margin-bottom:26px")}>Replay three attempts. Each result changes the evidence, the readiness signal and the next rehearsal ExamTwin compiles.</p>
              <div style={s("display:flex;flex-direction:column;gap:13px;margin-bottom:30px")}>
                <div style={s("display:flex;align-items:center;gap:12px;font-size:16px;font-weight:500")}><span style={s("color:var(--violet)")}>✓</span> Compare skill evidence across attempts</div>
                <div style={s("display:flex;align-items:center;gap:12px;font-size:16px;font-weight:500")}><span style={s("color:var(--violet)")}>✓</span> See exactly why the recommendation changed</div>
                <div style={s("display:flex;align-items:center;gap:12px;font-size:16px;font-weight:500")}><span style={s("color:var(--violet)")}>✓</span> Move from a score to the next decision</div>
              </div>
              <a href="#cta" className="lift" style={s("display:inline-flex;align-items:center;gap:10px;padding:14px 24px;background:var(--ink);color:var(--paper);font-weight:600;font-size:15.5px;border-radius:12px")}>Build my adaptive loop <span style={s("color:var(--acid)")}>→</span></a>
            </div>

            <div data-reveal data-d1 style={s("background:var(--win);color:var(--win-ink);border-radius:20px;box-shadow:var(--shadow-win);overflow:hidden")}>
              <div style={s("display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--win-2);border-bottom:1px solid var(--win-line)")}>
                <div style={s("display:flex;align-items:center;gap:9px")}>
                  <span style={s("width:11px;height:11px;border-radius:50%;background:#ff5f57")}></span><span style={s("width:11px;height:11px;border-radius:50%;background:#febc2e")}></span><span style={s("width:11px;height:11px;border-radius:50%;background:#28c840")}></span>
                  <span className="lbl" style={s("margin-left:8px;color:var(--win-muted);letter-spacing:.1em")}>Adaptive attempt history</span>
                </div>
                <span className="lbl" style={s("color:var(--win-muted)")}>● 3 runs · one moving target</span>
              </div>
              <div style={s("display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--win-line)")}>
                {RUNS.map((r, i) => {
                  const on = i === run;
                  return (
                    <button key={i} onClick={() => { setRun(i); setSkill(RUNS[i].bars.findIndex((b) => b.weak)); }} style={s(`display:flex;flex-direction:column;padding:16px 18px;text-align:left;border-right:${i < 2 ? "1px solid var(--win-line)" : "none"};border-bottom:3px solid ${on ? "var(--acid)" : "transparent"};background:${on ? "var(--win-2)" : "transparent"};transition:all .25s var(--ease);cursor:pointer`)}>
                      <span className="lbl" style={s("color:var(--acid);letter-spacing:.1em;margin-bottom:6px")}>{r.code}</span>
                      <span style={s(`font-weight:600;font-size:15px;color:${on ? "var(--win-ink)" : "var(--win-dim)"}`)}>{r.name}</span>
                      <span style={s("font-size:12px;color:var(--win-dim);margin-top:3px")}>{r.dday}</span>
                    </button>
                  );
                })}
              </div>
              <div style={s("padding:clamp(18px,2.4vw,28px)")}>
                <div className="swap" style={s("display:flex;gap:36px;margin-bottom:24px")}>
                  <div><div className="lbl" style={s("color:var(--win-dim);letter-spacing:.12em;margin-bottom:8px")}>Readiness</div><div style={s("font-size:46px;font-weight:700;letter-spacing:-.03em;line-height:.85")}>{runObj.readiness}</div><div style={s("font-size:12.5px;color:var(--acid);margin-top:6px")}>{runObj.delta}</div></div>
                  <div><div className="lbl" style={s("color:var(--win-dim);letter-spacing:.12em;margin-bottom:8px")}>Exam</div><div style={s("font-size:46px;font-weight:700;letter-spacing:-.03em;line-height:.85")}>29d</div><div style={s("font-size:12.5px;color:var(--win-dim);margin-top:6px")}>Quantum · Final 2025</div></div>
                </div>
                <div style={s("display:flex;flex-direction:column;gap:2px;margin-bottom:20px")}>
                  {runObj.bars.map((b, i) => {
                    const selRow = i === skill; const tone = b.weak ? "var(--danger)" : "var(--acid)";
                    return (
                      <button key={i} onClick={() => setSkill(i)} style={s(`display:flex;align-items:center;gap:14px;padding:9px 10px;border-radius:9px;text-align:left;background:${selRow ? "var(--win-2)" : "transparent"};transition:background .2s var(--ease);cursor:pointer`)}>
                        <span style={s(`width:120px;text-align:left;font-size:14px;font-weight:500;color:${selRow ? "var(--win-ink)" : "var(--win-muted)"}`)}>{b.skill}</span>
                        <span style={s("flex:1;height:8px;border-radius:99px;background:var(--win-line);overflow:hidden")}><span style={s(`display:block;width:${adaptIn ? b.val + "%" : "0%"};height:100%;border-radius:99px;background:${tone};transition:width .8s var(--ease)`)}></span></span>
                        <span style={s("width:34px;text-align:right;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums")}>{b.val}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="swap" style={s("display:flex;align-items:center;gap:14px;background:var(--win-2);border:1px solid var(--win-line);border-radius:13px;padding:15px 17px")}>
                  <span style={s("color:var(--acid);font-size:18px")}>◎</span>
                  <div style={s("flex:1")}><div className="lbl" style={s("color:var(--win-dim);letter-spacing:.1em;margin-bottom:3px")}>{`Inspecting · ${selBar.val}/100`}</div><div style={s("font-size:17px;font-weight:700;letter-spacing:-.01em")}>{selBar.skill}</div><div style={s("font-size:13px;color:var(--win-muted);margin-top:3px")}>Next: {runObj.next}</div></div>
                  <span style={s("color:var(--acid);font-size:18px")}>→</span>
                </div>
                <div className="cols-2 swap" style={s("display:grid;grid-template-columns:1.4fr 1fr;gap:12px;margin-top:12px")}>
                  <div style={s("background:var(--acid);color:var(--acid-ink);border-radius:13px;padding:15px 17px")}><div className="lbl" style={s("letter-spacing:.1em;opacity:.7;margin-bottom:6px")}>Why the plan changed</div><div style={s("font-size:13.5px;font-weight:500;line-height:1.45")}>{runObj.why}</div></div>
                  <div style={s("background:var(--acid);color:var(--acid-ink);border-radius:13px;padding:15px 17px")}><div className="lbl" style={s("letter-spacing:.1em;opacity:.7;margin-bottom:6px")}>Compiled next</div><div style={s("font-size:15.5px;font-weight:700;line-height:1.2")}>{runObj.next}</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 04 · PICK YOUR EXAM */}
        <section id="scenarios" style={s("max-width:1240px;margin:0 auto;padding:clamp(40px,5vw,76px) clamp(18px,4vw,60px) clamp(28px,3vw,48px)")}>
          <div className="split" data-reveal style={s("display:grid;grid-template-columns:1.25fr 1fr;gap:40px;align-items:end;margin-bottom:40px")}>
            <div>
              <span style={s("display:inline-block;background:var(--acid);color:var(--acid-ink);border-radius:999px;padding:7px 15px;margin-bottom:22px")} className="lbl">04 · Pick your exam</span>
              <h2 style={s("font-size:clamp(32px,4.4vw,58px);line-height:.98;letter-spacing:-.035em;font-weight:700")}>One engine.<br />Your exam's rules.</h2>
            </div>
            <p style={s("border-left:3px solid var(--violet);padding-left:20px;font-size:clamp(16px,1.4vw,19px);line-height:1.45;color:var(--ink);margin:0;max-width:36ch")}>Change the exam and watch the rehearsal recompile around its actual pressure.</p>
          </div>

          <div data-reveal data-d1 style={s("background:var(--win);color:var(--win-ink);border-radius:20px;box-shadow:var(--shadow-win);overflow:hidden")}>
            <div style={s("display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--win-2);border-bottom:1px solid var(--win-line)")}>
              <div style={s("display:flex;align-items:center;gap:9px")}>
                <span style={s("width:12px;height:12px;border-radius:50%;background:#ff5f57")}></span><span style={s("width:12px;height:12px;border-radius:50%;background:#febc2e")}></span><span style={s("width:12px;height:12px;border-radius:50%;background:#28c840")}></span>
                <span className="lbl" style={s("margin-left:10px;color:var(--win-muted);letter-spacing:.12em")}>Exam blueprint</span>
              </div>
              <span className="lbl" style={s("display:inline-flex;align-items:center;gap:7px;color:var(--win-muted)")}><span className="blink" style={s("width:7px;height:7px;border-radius:50%;background:var(--acid)")}></span>Live recompilation</span>
            </div>
            <div className="bp-body" style={s("display:grid;grid-template-columns:.8fr 1.2fr")}>
              <div style={s("border-right:1px solid var(--win-line)")}>
                {BLUEPRINTS.map((b, i) => {
                  const on = i === bp;
                  return (
                    <button key={i} onClick={() => setBp(i)} style={s(`display:flex;flex-direction:column;width:100%;padding:20px 22px;text-align:left;border-bottom:1px solid var(--win-line);transition:all .25s var(--ease);cursor:pointer;${on ? "background:var(--violet);color:var(--violet-ink)" : "background:transparent;color:var(--win-ink)"}`)}>
                      <span className="lbl" style={s(`letter-spacing:.14em;color:${on ? "var(--acid)" : "var(--win-dim)"};margin-bottom:8px`)}>{b.cat}</span>
                      <span style={s("display:flex;align-items:center;justify-content:space-between;gap:10px")}><span style={s("font-size:21px;font-weight:700;letter-spacing:-.02em")}>{b.name}</span><span style={s(`font-size:16px;color:${on ? "var(--acid)" : "var(--win-dim)"}`)}>→</span></span>
                      <span style={s(`font-size:13px;color:${on ? "rgba(244,243,255,.8)" : "var(--win-dim)"};margin-top:6px`)}>{b.run} run</span>
                    </button>
                  );
                })}
              </div>
              <div style={s("padding:clamp(24px,3.4vw,48px);position:relative;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:44px 44px")}>
                <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:auto")}><span style={s("font-size:14px;color:var(--win-muted)")}>{bpObj.exam}</span><span className="lbl" style={s("color:var(--acid);letter-spacing:.1em")}>{bpObj.dday}</span></div>
                <div className="swap" style={s("margin-top:clamp(30px,5vw,72px)")}>
                  <div className="lbl" style={s("color:var(--win-dim);letter-spacing:.14em;margin-bottom:14px")}>Next rehearsal</div>
                  <h3 style={s("font-size:clamp(30px,3.6vw,50px);line-height:1;letter-spacing:-.035em;font-weight:700;max-width:16ch")}>{bpObj.title}</h3>
                  <div style={s("height:1px;background:var(--win-line);margin:26px 0 20px")}></div>
                  <div style={s("display:flex;align-items:baseline;gap:16px")}><span style={s("font-size:40px;font-weight:700;letter-spacing:-.03em")}>{bpObj.run}</span><span style={s("font-size:14px;color:var(--win-muted)")}>one timebox · {bpObj.target}</span></div>
                </div>
                <div style={s("text-align:center;margin-top:clamp(24px,4vw,52px);font-size:13px;color:var(--win-dim)")}><span style={s("color:var(--acid)")}>●</span> Click another exam to recompile the preview</div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section id="compare" style={s("max-width:1240px;margin:0 auto;padding:clamp(40px,5vw,76px) clamp(18px,4vw,60px) clamp(28px,3vw,48px)")}>
          <div className="split" data-reveal style={s("display:grid;grid-template-columns:1.3fr 1fr;gap:40px;align-items:end;margin-bottom:40px")}>
            <h2 style={s("font-size:clamp(32px,4.4vw,58px);line-height:.98;letter-spacing:-.035em;font-weight:700")}>More questions—or a<br />better next decision?</h2>
            <p style={s("border-left:3px solid var(--violet);padding-left:20px;font-size:clamp(16px,1.4vw,19px);line-height:1.45;color:var(--ink);margin:0;max-width:36ch")}>The same source material can produce more noise or one clear next step.</p>
          </div>

          <div data-reveal data-d1 style={s("background:var(--win);border-radius:20px;box-shadow:var(--shadow-win);overflow:hidden")}>
            <div style={s("display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--win-2);border-bottom:1px solid var(--win-line)")}>
              <div style={s("display:flex;align-items:center;gap:9px")}>
                <span style={s("width:12px;height:12px;border-radius:50%;background:#ff5f57")}></span><span style={s("width:12px;height:12px;border-radius:50%;background:#febc2e")}></span><span style={s("width:12px;height:12px;border-radius:50%;background:#28c840")}></span>
                <span className="lbl" style={s("margin-left:10px;color:var(--win-muted);letter-spacing:.12em")}>Decision engine</span>
              </div>
              <span className="lbl" style={s("color:var(--win-muted)")}>● Same input · different output</span>
            </div>
            <div className="compare-body" style={s("display:grid;grid-template-columns:1fr 1fr")}>
              <div style={s("background:var(--paper);color:var(--ink);padding:clamp(26px,3.4vw,46px);border-right:1px solid var(--win-line)")}>
                <div className="lbl" style={s("color:var(--violet);letter-spacing:.14em;margin-bottom:22px")}>The old loop</div>
                <h3 style={s("font-size:clamp(30px,3.6vw,50px);line-height:.98;letter-spacing:-.035em;font-weight:700;margin-bottom:30px")}>Quiz generators make more questions.</h3>
                <div className="quiz-scatter" onMouseLeave={resetQuiz} style={s("position:relative;height:192px")}>
                  <svg style={s("position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:1")}>
                    {qArrows.map((a, i) => (
                      <path key={i} className="qarrow" pathLength="400" d={a.d} fill="none" stroke="var(--violet)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path>
                    ))}
                  </svg>
                  {QUIZWORDS.map((word, i) => {
                    const rev = qrevRef.current.indexOf(i) > -1; const cur = i === qcur;
                    return (
                      <div key={i} className="qcard" data-i={i} onMouseEnter={qEnter(i)} style={s(`position:absolute;left:${lefts[i]}%;top:${tops[i]}px;width:${rev ? "142px" : "62px"};height:80px;display:grid;place-items:center;background:#fff;border:1.5px solid ${rev ? "var(--violet)" : "var(--line-strong)"};border-radius:12px;box-shadow:${cur ? "0 20px 42px rgba(75,57,247,.26)" : "0 8px 20px rgba(14,14,11,.08)"};transform:rotate(${cur ? 0 : rots[i]}deg) scale(${cur ? 1.14 : rev ? 1.05 : 1});transform-origin:center;transition:all .38s var(--ease);cursor:pointer;z-index:${cur ? 40 : rev ? 25 : 6 + i};overflow:hidden`)}>
                        <span style={s(`grid-area:1/1;font-size:22px;font-weight:700;color:var(--ink-dim);opacity:${rev ? 0 : 1};transition:opacity .2s`)}>?</span>
                        <span style={s(`grid-area:1/1;padding:0 12px;text-align:center;font-size:12.5px;font-weight:700;letter-spacing:-.01em;line-height:1.12;color:var(--violet);opacity:${rev ? 1 : 0};transition:opacity .3s .12s`)}>{word}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={s("margin-top:18px;display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:500;color:var(--ink-soft)")}><span style={s("color:var(--violet)")}>✎</span> Hover the cards — same topics, drawn at random, no decision.</div>
              </div>
              <div style={s("background:var(--acid);color:var(--acid-ink);padding:clamp(26px,3.4vw,46px)")}>
                <div className="lbl" style={s("letter-spacing:.14em;opacity:.65;margin-bottom:22px")}>The ExamTwin loop</div>
                <h3 style={s("font-size:clamp(30px,3.6vw,50px);line-height:.98;letter-spacing:-.035em;font-weight:700;margin-bottom:22px")}>ExamTwin decides which rehearsal deserves your time.</h3>
                <p style={s("font-size:15.5px;line-height:1.5;opacity:.82;max-width:40ch;margin-bottom:26px")}>Generation is only the last step. First comes a reconstructed exam, real evidence and a deliberate constraint.</p>
                <div style={s("display:inline-flex;align-items:center;gap:12px;background:var(--acid-ink);color:var(--acid);border-radius:13px;padding:15px 20px;font-weight:700;font-size:15.5px")}>
                  <span>◎</span> One rehearsal, chosen on purpose
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT TEASER */}
        <section style={s("max-width:1240px;margin:0 auto;padding:clamp(40px,5vw,72px) clamp(18px,4vw,60px)")}>
          <div data-reveal className="about-grid" style={s("display:grid;grid-template-columns:1.5fr 1fr;gap:30px;background:var(--violet);color:var(--violet-ink);border-radius:26px;padding:clamp(30px,4.4vw,64px);align-items:center")}>
            <div>
              <div className="lbl" style={s("opacity:.72;letter-spacing:.14em;margin-bottom:20px")}>Built in Vienna</div>
              <h2 style={s("font-size:clamp(32px,4.4vw,58px);line-height:.98;letter-spacing:-.035em;font-weight:700;margin-bottom:22px")}>We made the study tool we needed ourselves.</h2>
              <p style={s("font-size:clamp(16px,1.4vw,19px);line-height:1.55;opacity:.86;max-width:52ch;margin-bottom:30px")}>ExamTwin started with a team of students, a hackathon deadline and a frustration: plenty of study content, but no system for deciding what to practise next.</p>
              <a href="/about" className="lift-white" style={s("display:inline-flex;align-items:center;gap:10px;background:#fff;color:var(--violet);font-weight:700;font-size:15.5px;padding:14px 24px;border-radius:12px")}>Read our story <span>→</span></a>
            </div>
            <div style={s("display:flex;justify-content:center;align-items:center")}>
              <div style={s("width:min(260px,80%);aspect-ratio:1;border-radius:50%;border:1px solid rgba(255,255,255,.28);display:grid;place-items:center;text-align:center;padding:24px")}>
                <div>
                  <div style={s("width:60px;height:60px;margin:0 auto 16px;border-radius:50%;border:3px solid var(--acid);display:grid;place-items:center")}><span style={s("width:26px;height:26px;border-radius:50%;border:3px solid var(--acid)")}></span></div>
                  <div className="lbl" style={s("color:var(--acid);letter-spacing:.14em;line-height:1.7")}>OpenAI<br />Build Week<br />2026</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={s("max-width:1240px;margin:0 auto;padding:clamp(56px,7vw,96px) clamp(18px,4vw,60px) clamp(40px,5vw,72px)")}>
          <div data-reveal style={s("margin-bottom:40px")}>
            <span style={s("display:inline-block;background:var(--acid);color:var(--acid-ink);border-radius:999px;padding:7px 15px;margin-bottom:22px")} className="lbl">06 · FAQ</span>
            <h2 style={s("font-size:clamp(34px,4.6vw,62px);line-height:.96;letter-spacing:-.035em;font-weight:700")}>Questions, answered.</h2>
          </div>
          <div data-reveal data-d1 style={s("display:flex;flex-direction:column")}>
            {FAQ.map((f, i) => {
              const open = i === faq;
              return (
                <div key={i} style={s("border-top:1px solid var(--line)")}>
                  <button onClick={() => setFaq(open ? -1 : i)} style={s("width:100%;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px 4px;text-align:left")}>
                    <span style={s("font-size:clamp(18px,1.8vw,22px);font-weight:600;letter-spacing:-.01em;color:var(--ink)")}>{f.q}</span>
                    <span style={s(`font-size:22px;color:${open ? "var(--violet)" : "var(--ink-soft)"};transition:transform .3s var(--ease);transform:${open ? "rotate(45deg)" : "rotate(0deg)"}`)}>+</span>
                  </button>
                  <div style={s(`overflow:hidden;transition:max-height .4s var(--ease),opacity .3s var(--ease);max-height:${open ? "240px" : "0px"};opacity:${open ? "1" : "0"}`)}>
                    <p style={s("font-size:clamp(15px,1.4vw,17px);line-height:1.6;color:var(--ink-soft);max-width:64ch;padding:0 4px 26px;margin:0")}>{f.a}</p>
                  </div>
                </div>
              );
            })}
            <div style={s("border-top:1px solid var(--line)")}></div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section id="cta" style={s("background:var(--acid);color:var(--acid-ink)")}>
          <div data-reveal style={s("max-width:1000px;margin:0 auto;padding:clamp(64px,9vw,140px) clamp(18px,4vw,60px);text-align:center")}>
            <div style={s("display:inline-flex;align-items:center;gap:9px;background:rgba(18,22,10,.08);border:1px solid rgba(18,22,10,.16);border-radius:999px;padding:8px 16px;margin-bottom:30px")}><span>✦</span><span className="lbl" style={s("letter-spacing:.13em")}>Built around your real exam</span></div>
            <h2 style={s("font-size:clamp(44px,7vw,100px);line-height:.9;letter-spacing:-.045em;font-weight:700;margin-bottom:24px")}>Know what to practise next.</h2>
            <p style={s("font-size:clamp(17px,1.7vw,21px);line-height:1.5;opacity:.8;max-width:40ch;margin:0 auto 36px")}>Upload the material. Get one focused rehearsal with a reason behind it.</p>
            <a href="#top" className="lift-final" style={s("display:inline-flex;align-items:center;gap:11px;background:var(--ink);color:var(--paper);font-weight:700;font-size:17px;padding:18px 34px;border-radius:14px")}>Build my exam twin <span style={s("color:var(--acid)")}>→</span></a>
            <div className="lbl" style={s("letter-spacing:.1em;opacity:.55;margin-top:24px")}>No credit card · Start with your own materials</div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={s("background:var(--win);color:var(--win-ink)")}>
          <div className="foot-grid" style={s("max-width:1240px;margin:0 auto;padding:clamp(48px,6vw,80px) clamp(18px,4vw,60px) 40px;display:grid;grid-template-columns:1.6fr 1fr 1fr;gap:48px")}>
            <div>
              <div style={s("display:flex;align-items:center;gap:11px;font-weight:700;font-size:20px;margin-bottom:18px")}>
                <span style={s("width:26px;height:26px;border-radius:50%;border:2.5px solid var(--acid);display:grid;place-items:center")}><span style={s("width:12px;height:12px;border-radius:50%;border:2.5px solid var(--acid)")}></span></span>
                ExamTwin
              </div>
              <p style={s("font-size:15px;line-height:1.55;color:var(--win-muted);max-width:38ch")}>Adaptive exam rehearsals built from the materials that define your real exam.</p>
            </div>
            <div>
              <div className="lbl" style={s("color:var(--acid);letter-spacing:.14em;margin-bottom:18px")}>Product</div>
              <div style={s("display:flex;flex-direction:column;gap:12px;font-size:15px;color:var(--win-muted)")}>
                <a href="#process" style={s("color:inherit")} className="uline">How it works</a>
                <a href="#demo" style={s("color:inherit")} className="uline">Live preview</a>
                <a href="#cta" style={s("color:inherit")} className="uline">Start free</a>
              </div>
            </div>
            <div>
              <div className="lbl" style={s("color:var(--acid);letter-spacing:.14em;margin-bottom:18px")}>Company</div>
              <div style={s("display:flex;flex-direction:column;gap:12px;font-size:15px;color:var(--win-muted)")}>
                <a href="/about" style={s("color:inherit")} className="uline">Our story</a>
                <a href="#cta" style={s("color:inherit")} className="uline">Feedback</a>
                <a href="#top" style={s("color:inherit")} className="uline">GitHub</a>
              </div>
            </div>
          </div>
          <div style={s("max-width:1240px;margin:0 auto;padding:0 clamp(18px,4vw,60px) 40px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap")}>
            <span className="lbl" style={s("color:var(--win-dim);letter-spacing:.1em")}>© 2026 ExamTwin</span>
            <span className="lbl" style={s("color:var(--win-dim);letter-spacing:.1em")}>Made by students in Vienna</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
