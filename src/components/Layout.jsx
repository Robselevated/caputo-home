import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-ivory relative">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-ivory w-full px-6 pb-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
        <div className="flex items-center justify-between w-full max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-olive-light flex items-center justify-center">
              <span className="text-section-grocery font-heading font-bold text-lg">C</span>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-charcoal">Caputo Home</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-32 max-w-md mx-auto pt-[calc(5rem+max(2rem,env(safe-area-inset-top,0px)))]">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
