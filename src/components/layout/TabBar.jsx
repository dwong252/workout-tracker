import { NavLink } from 'react-router-dom'
import { Home, LayoutList, Dumbbell, BarChart2, CalendarDays } from 'lucide-react'

const tabs = [
  { to: '/',          label: 'Home',      Icon: Home },
  { to: '/templates', label: 'Templates', Icon: LayoutList },
  { to: '/exercises', label: 'Exercises', Icon: Dumbbell },
  { to: '/progress',  label: 'Progress',  Icon: BarChart2 },
  { to: '/calendar',  label: 'Calendar',  Icon: CalendarDays },
]

export default function TabBar() {
  return (
    <nav className="tab-bar flex-shrink-0 bg-sys-bg2/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-t border-sys-separator dark:border-white/10 flex">
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 transition-colors
             ${isActive ? 'text-ios-blue' : 'text-sys-label3 dark:text-white/35'}`
          }
        >
          <Icon size={24} strokeWidth={1.75} />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
