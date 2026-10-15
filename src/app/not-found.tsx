import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="container-site flex flex-col items-start gap-4 py-20">
      <h1 className="h1">Page not found</h1>
      <p className="text-ink-soft m-0 text-lg">That page doesn&apos;t exist or has moved.</p>
      <Link href="/" className="btn btn-primary">
        Go home
      </Link>
    </section>
  );
}
