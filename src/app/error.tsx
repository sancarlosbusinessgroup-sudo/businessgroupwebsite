'use client';

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-site flex flex-col items-start gap-4 py-20" role="alert">
      <h1 className="h1">Something went wrong</h1>
      <p className="text-ink-soft m-0 text-lg">We couldn&apos;t load this page. Please try again in a moment.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
