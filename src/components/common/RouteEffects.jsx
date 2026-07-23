import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function RouteEffects() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])

  return null
}
