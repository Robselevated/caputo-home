import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto relative">
      <main className="pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
