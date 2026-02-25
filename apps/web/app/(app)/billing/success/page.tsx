import Link from 'next/link'

export default function BillingSuccessPage() {
  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 mb-3">You're all set!</h1>
      <p className="text-slate-500 mb-6">
        Your subscription is active. Your new plan limits apply immediately.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
      >
        Go to dashboard
      </Link>
    </div>
  )
}
