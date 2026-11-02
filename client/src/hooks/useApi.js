import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api';

/** GET `url` with `params`; refetches when they change. Pass url=null to skip. */
export function useApi(url, params) {
  const key = url ? url + JSON.stringify(params || {}) : null;
  const [state, setState] = useState({ data: null, loading: !!url, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get(url, { params })
      .then((r) => alive && setState({ data: r.data, loading: false, error: null }))
      .catch((e) => alive && setState((s) => ({ ...s, loading: false, error: errMsg(e) })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
