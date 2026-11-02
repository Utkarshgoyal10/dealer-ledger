import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) onUnauthorized();
    return Promise.reject(err);
  }
);

export function errMsg(e) {
  if (!e?.response) return 'Cannot reach server. Check your internet.';
  return e.response.data?.message || 'Something went wrong';
}

/** Downloads a file (Excel/PDF export) from an authenticated endpoint */
export async function download(url, params, fallbackName = 'report') {
  let res;
  try {
    res = await api.get(url, { params, responseType: 'blob' });
  } catch (e) {
    // Error bodies come back as blobs too
    if (e.response?.data instanceof Blob) {
      try {
        const j = JSON.parse(await e.response.data.text());
        throw new Error(j.message);
      } catch (inner) {
        throw inner instanceof SyntaxError ? new Error('Download failed') : inner;
      }
    }
    throw new Error(errMsg(e));
  }
  const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
