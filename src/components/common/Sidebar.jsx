import { BadgeCheck, LayoutDashboard, MessageCircleQuestion, School } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const iconByName = {
  BadgeCheck,
  LayoutDashboard,
  MessageCircleQuestion,
  School,
}

export default function Sidebar({ items = [] }) {
  return (
    <aside className="sidebar" aria-label="Điều hướng giảng viên">
      <ul className="sidebar__list">
        {items.map((item) => {
          const Icon = iconByName[item.icon]
          return (
            <li key={item.id} className="sidebar__item">
              <NavLink
                end={item.end}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
              >
                {Icon && <Icon aria-hidden="true" className="sidebar__icon" size={19} />}
                <span className="sidebar__label">{item.label}</span>
                {item.badge ? <span className="sidebar__badge">{item.badge}</span> : null}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
