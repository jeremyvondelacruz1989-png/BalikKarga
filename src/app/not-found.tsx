import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="mt-2 text-sm text-slate-600">This page doesn&apos;t exist or you don&apos;t have access to it.</p>
      <Link href="/dashboard" className="btn-primary mt-4">
        Back to dashboard
      </Link>
    </div>
  );
}
