const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'workforce_access_token';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const saveToken = (token) => {
  sessionStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
};

export const hasToken = () => Boolean(sessionStorage.getItem(TOKEN_KEY));

export const apiRequest = async (path, options = {}) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check that the backend is running.', 0);
  }

  const result = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('auth:expired'));
  }

  if (!response.ok) {
    throw new ApiError(result.message || 'The request could not be completed.', response.status);
  }

  return result;
};
