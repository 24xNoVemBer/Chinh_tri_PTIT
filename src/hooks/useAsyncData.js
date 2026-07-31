import { useCallback, useEffect, useRef, useState } from 'react'

const INITIAL_STATE = { data: null, loading: true, error: null, refreshing: false }

/**
 * Loads data for the current `loader` and keeps the async states coherent.
 *
 * `loader` must be referentially stable (wrap it in useCallback); it doubles as the
 * identity of the request, so a new loader means a new record and the previous record's
 * data is dropped rather than shown under the new route.
 *
 * `reload()` refreshes in place: it sets `refreshing` instead of `loading`, so a mutation
 * does not tear the page down to a spinner and lose whatever the user was typing.
 */
export default function useAsyncData(loader) {
  const [state, setState] = useState(INITIAL_STATE)
  const [activeLoader, setActiveLoader] = useState(() => loader)
  const reloadTokenRef = useRef(0)

  // Reset during render rather than in an effect. `loader` identifies the record being
  // viewed, so when it changes the previous record's data must not survive even for one
  // paint — React re-runs this component immediately without committing the stale tree.
  if (activeLoader !== loader) {
    setActiveLoader(() => loader)
    setState(INITIAL_STATE)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await loader()
        if (!cancelled) setState({ data, loading: false, error: null, refreshing: false })
      } catch (error) {
        if (!cancelled) setState({ data: null, loading: false, error, refreshing: false })
      }
    }

    void load()

    return () => {
      cancelled = true
      // Also invalidate any reload still in flight, so its response cannot land on top of
      // the record we are switching to.
      reloadTokenRef.current += 1
    }
  }, [loader])

  const reload = useCallback(async () => {
    reloadTokenRef.current += 1
    const token = reloadTokenRef.current
    setState((current) => ({
      ...current,
      loading: current.data === null,
      refreshing: current.data !== null,
      error: null,
    }))

    try {
      const data = await loader()
      if (reloadTokenRef.current !== token) return
      setState({ data, loading: false, error: null, refreshing: false })
    } catch (error) {
      if (reloadTokenRef.current !== token) return
      setState({ data: null, loading: false, error, refreshing: false })
    }
  }, [loader])

  return { ...state, reload }
}
