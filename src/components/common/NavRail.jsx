import React from 'react'
import { NavLink } from 'react-router-dom'
import './NavRail.css'

const NavRail = ({ items = [], sections = [] }) => {
  return (
    <nav className="navrail">
      {items.length > 0 && (
        <ul className="navrail__list">
          {items.map((item) => (
            <li key={item.id} className="navrail__item">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `navrail__link ${isActive ? 'navrail__link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}

      {sections.map((section, idx) => (
        <div key={idx} className="navrail__section">
          {section.title && <h4 className="navrail__section-title">{section.title}</h4>}
          <ul className="navrail__list">
            {section.items.map((item) => (
              <li key={item.id} className="navrail__item">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `navrail__link ${isActive ? 'navrail__link--active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export default NavRail
