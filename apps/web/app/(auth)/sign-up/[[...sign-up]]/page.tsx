import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center"
      style={{
        backgroundImage: 'url(/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/75" />

      <div className="relative z-10">
        <SignUp
          appearance={{
            layout: {
              logoImageUrl: '/logo-cropped.png',
              logoLinkUrl: '/',
            },
            elements: {
              card: 'bg-white/85 backdrop-blur-md shadow-2xl border-0 rounded-xl',
              logoImage: 'h-[120px] w-auto',
              headerTitle: 'text-slate-900',
              headerSubtitle: 'text-slate-500',
              socialButtonsBlockButton: 'border-slate-200 hover:bg-slate-50',
              formFieldInput: 'border-slate-300 focus:border-slate-500',
              footerActionLink: 'text-slate-700 hover:text-slate-900',
              footerBranding: '!hidden',
            },
          }}
        />
      </div>
    </div>
  )
}
