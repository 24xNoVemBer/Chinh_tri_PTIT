import React from 'react'
import { Outlet } from 'react-router-dom'
import NavRail from '../components/common/NavRail'
import './ReadingLayout.css'

const ReadingLayout = ({ navRailItems, navRailSections, showNavRail = false }) => {
  return (
    <div className="reading-layout">
      {showNavRail && (
        <div className="reading-layout__navrail">
          <NavRail items={navRailItems} sections={navRailSections} />
        </div>
      )}
      <main
        className={`reading-layout__main ${showNavRail ? 'reading-layout__main--with-nav' : ''}`}
      >
        <div className="reading-layout__content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default ReadingLayout
