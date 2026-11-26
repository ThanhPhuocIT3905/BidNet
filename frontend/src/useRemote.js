import { useCallback, useEffect, useRef, useState } from "react";

// Keep the latest successful data during refresh; discard out-of-order responses.
export default function useRemote(load, deps = []) {
  const key = JSON.stringify(deps);
  const loader = useRef(load);
  loader.current = load;
  const sequence = useRef(0);
  const [state, setState] = useState({ key, loading: true, data: null, error: "" });
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setState(s => ({ ...s, loading: true }));
    try {
      const data = await loader.current();
      if (sequence.current === request) setState({ key, data, loading: false, error: "" });
    } catch (error) {
      if (sequence.current === request)
        setState(s => ({ key, data: s.key === key ? s.data : null, loading: false, error: error.message }));
    }
  }, [key]);
  useEffect(() => {
    reload();
    return () => { sequence.current++; };
  }, [reload]);
  return { ...(state.key === key ? state : { data: null, loading: true, error: "" }), reload };
}
