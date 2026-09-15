export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 py-32 px-8 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-3xl shadow-lg">
            🎯
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            AI Interview Prep Kit
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-500 dark:text-zinc-400">
            AI-powered interview preparation — practice questions, flashcards,
            and study schedules tailored to any job description.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Scaffold ready — auth, retrieval &amp; LLM phases coming soon
        </div>
      </main>
    </div>
  );
}
