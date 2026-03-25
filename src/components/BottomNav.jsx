import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/grocery', label: 'Grocery', icon: 'shopping_cart' },
  { path: '/freezer', label: 'Freezer', icon: 'ac_unit' },
  { path: '/fridge', label: 'Fridge', icon: 'kitchen' },
  { path: '/pantry', label: 'Pantry', icon: 'inventory_2' },
  { path: '/home-goods', label: 'Home', icon: 'home' },
  { path: '/cookbook', label: 'Cookbook', icon: 'menu_book' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 bg-white/70 backdrop-blur-xl rounded-t-[2rem] px-2 pb-safe shadow-[0_-1px_0_rgba(0,0,0,0.04),0_-12px_32px_rgba(44,47,48,0.06)]">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center p-1.5 transition-transform duration-200 ${
              isActive
                ? 'bg-[#006A6A]/10 text-[#006A6A] rounded-2xl scale-110'
                : 'text-slate-500 hover:bg-slate-100/50'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="material-symbols-outlined text-xl mb-0.5"
                style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
              >
                {item.icon}
              </span>
              <span className="text-[9px] font-medium tracking-wide">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
