import Link from 'next/link'

export default function BillingCancelPage() {
  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 mb-3">No changes made</h1>
      <p className="text-slate-500 mb-6">
        Your subscription was not changed.
      </p>
      <Link
        href="/billing"
        className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
      >
        Back to billing
      </Link>
    </div>
  )
}
