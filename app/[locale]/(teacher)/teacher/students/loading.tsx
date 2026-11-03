export default function TeacherStudentsLoading() {
  return (
    <section className="teacher-reference-page animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-52 rounded-xl bg-muted" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-muted" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl border bg-card" />
        ))}
      </div>
      <div className="mt-5 h-20 rounded-2xl border bg-card" />
      <div className="mt-5 h-80 rounded-2xl border bg-card" />
    </section>
  );
}
