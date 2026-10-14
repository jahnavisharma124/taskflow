const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// One helper for every request: adds the JWT token and handles errors.
export async function api(path, options = {}) {
  const token = localStorage.getItem('token');

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // response had no JSON body
  }

  if (!res.ok) {
    // Token expired or invalid: clear it and go back to login
    if (res.status === 401 && token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error(data?.message || 'Request failed');
  }
  return data;
}
