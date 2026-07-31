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

  // aria-label is ignored on a plain span (role=generic), so with the digits marked
  // aria-hidden the value was announced as nothing at all. Expose the real number as text
  // in a visually hidden node instead, and keep the animated copy decorative.
  return (
    <span className="animated-number">
      <span className="sr-only">{`${target}${suffix}`}</span>
      <span aria-hidden="true">
        {reduceMotion ? target : displayValue}
        {suffix}
      </span>
    </span>
  )
}
