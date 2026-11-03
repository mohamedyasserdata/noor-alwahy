export default function TeacherSessionWorkspaceLoading() {
  return (
    <section className="teacher-reference-page animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-44 rounded-2xl border bg-card" />
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="h-72 rounded-2xl border bg-card" />
        <div className="h-72 rounded-2xl border bg-card" />
      </div>
      <div className="mt-4 h-80 rounded-2xl border bg-card" />
    </section>
  );
}
