import { useCallback, useEffect, useState } from 'react'

export default function useAsyncData(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))

    try {
      const data = await loader()
      setState({ data, loading: false, error: null })
    } catch (error) {
      setState({ data: null, loading: false, error })
    }
  }, [loader])

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        const data = await loader()
        if (!cancelled) setState({ data, loading: false, error: null })
      } catch (error) {
        if (!cancelled) setState({ data: null, loading: false, error })
      }
    }

    loadInitialData()

    return () => {
      cancelled = true
    }
  }, [loader])

  return { ...state, reload: load }
}
