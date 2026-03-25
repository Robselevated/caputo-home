import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-ivory max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto relative">
      <main className="pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
