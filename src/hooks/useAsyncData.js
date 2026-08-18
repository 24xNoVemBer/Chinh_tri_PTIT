import { useCallback, useEffect, useRef, useState } from 'react'

export default function useAsyncData(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const mountedRef = useRef(false)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    if (mountedRef.current) {
      setState((current) => ({ ...current, loading: true, error: null }))
    }

    try {
      const data = await loader()
      if (mountedRef.current && requestId === requestIdRef.current) {
        setState({ data, loading: false, error: null })
      }
    } catch (error) {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setState({ data: null, loading: false, error })
      }
    }
  }, [loader])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    let cancelled = false

    async function loadInitialData() {
      try {
        const data = await loader()
        if (!cancelled && mountedRef.current && requestId === requestIdRef.current) {
          setState({ data, loading: false, error: null })
        }
      } catch (error) {
        if (!cancelled && mountedRef.current && requestId === requestIdRef.current) {
          setState({ data: null, loading: false, error })
        }
      }
    }

    loadInitialData()

    return () => {
      cancelled = true
    }
  }, [loader])

  return { ...state, reload: load }
}
