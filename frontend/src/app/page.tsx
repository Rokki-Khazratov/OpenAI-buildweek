export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-2xl space-y-5 rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">
          ExamTwin
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Adaptive exam preparation, built around the real exam.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          The frontend foundation is ready. Product pages and authenticated study workflows will
          be implemented in feature slices.
        </p>
      </section>
    </main>
  );
}
