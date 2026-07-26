import { useEffect, useState } from 'react'

const DURATION = 420

function shouldReduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function AnimatedNumber({ value, suffix = '' }) {
  const target = Number.isFinite(value) ? value : 0
  const reduceMotion = shouldReduceMotion()
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (reduceMotion) return undefined

    let frameId
    const startedAt = performance.now()
    const requestFrame =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback) => setTimeout(() => callback(performance.now()), 16)
    const cancelFrame =
      typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / DURATION)
      const easedProgress = 1 - (1 - progress) ** 3
      setDisplayValue(Math.round(target * easedProgress))
      if (progress < 1) frameId = requestFrame(tick)
    }

    frameId = requestFrame(tick)
    return () => cancelFrame(frameId)
  }, [reduceMotion, target])

  return (
    <span className="animated-number" aria-label={`${target}${suffix}`}>
      <span aria-hidden="true">
        {reduceMotion ? target : displayValue}
        {suffix}
      </span>
    </span>
  )
}
