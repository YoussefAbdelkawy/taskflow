/* exported api */
// The ONE place the frontend talks to the backend. Tony extends this file.
// Every page calls api.get(...) / api.post(...) instead of writing fetch() itself.
// The login token is kept in localStorage and sent as "Authorization: Bearer <token>".
const api = (() => {
  const TOKEN_KEY = 'taskflow.token';
  const LOGIN_PAGE = 'login.html';
  const HTTP_NO_CONTENT = 204;
  const HTTP_UNAUTHORIZED = 401;

  // localStorage can throw (private mode, blocked site data), so every access is guarded.
  function readToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // nothing to do: the user simply stays logged out
    }
  }

  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // nothing to do: there is no stored token to remove
    }
  }

  function headersFor(token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  // 204 has no body, and an unexpected error page may not be JSON.
  async function readBody(response) {
    if (response.status === HTTP_NO_CONTENT) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function goToLogin() {
    clearToken();
    if (!location.pathname.endsWith(`/${LOGIN_PAGE}`)) location.href = LOGIN_PAGE;
  }

  async function request(method, url, body) {
    const response = await fetch(`/api${url}`, {
      method,
      headers: headersFor(readToken()),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await readBody(response);
    if (response.status === HTTP_UNAUTHORIZED) goToLogin();
    if (!response.ok) throw new Error(data?.error || 'Request failed');
    return data;
  }

  return {
    request,
    setToken,
    clearToken,
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body),
    put: (url, body) => request('PUT', url, body),
    patch: (url, body) => request('PATCH', url, body),
    delete: (url) => request('DELETE', url),
  };
})();
