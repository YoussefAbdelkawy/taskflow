/* exported api */
// The ONE place the frontend talks to the backend.
// Every page calls api.get(...) / api.post(...) instead of writing fetch() itself.
// The login token is kept in localStorage and sent as "Authorization: Bearer <token>".
//
// Error contract (M3): every failed call throws an ApiError { status, message, details }.
// status 0 = the server could not be reached; message is the server's own { error } text;
// details is the whole JSON body. A 401 also clears the token and opens login.html?next=…
const api = (() => {
  const TOKEN_KEY = 'taskflow.token';
  const LOGIN_PAGE = 'login.html';
  const HTTP_NO_CONTENT = 204;
  const HTTP_UNAUTHORIZED = 401;
  const NO_CONNECTION = 0;
  const FILE_NAME = /filename="?([^";]+)"?/;

  class ApiError extends Error {
    constructor(status, message, details = null) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.details = details;
    }
  }

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

  // Back to login, remembering this page so the login form can return here
  function goToLogin() {
    clearToken();
    if (location.pathname.endsWith(`/${LOGIN_PAGE}`)) return;
    const here = `${location.pathname.split('/').pop() || 'index.html'}${location.search || ''}`;
    location.href = `${LOGIN_PAGE}?next=${encodeURIComponent(here)}`;
  }

  async function send(method, url, body) {
    try {
      return await fetch(`/api${url}`, {
        method,
        headers: headersFor(readToken()),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(NO_CONNECTION, 'Cannot reach the server');
    }
  }

  async function failWith(response) {
    const data = await readBody(response);
    if (response.status === HTTP_UNAUTHORIZED) goToLogin();
    return new ApiError(
      response.status,
      data?.error || `Request failed (${response.status})`,
      data,
    );
  }

  async function request(method, url, body) {
    const response = await send(method, url, body);
    if (!response.ok) throw await failWith(response);
    return readBody(response);
  }

  // US7-2: a file the server sends as an attachment (a plain link could not send the token)
  async function download(url) {
    const response = await send('GET', url);
    if (!response.ok) throw await failWith(response);
    const disposition = response.headers.get('Content-Disposition') ?? '';
    return {
      blob: await response.blob(),
      fileName: FILE_NAME.exec(disposition)?.[1] ?? 'download',
    };
  }

  return {
    ApiError,
    request,
    download,
    setToken,
    clearToken,
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body),
    put: (url, body) => request('PUT', url, body),
    patch: (url, body) => request('PATCH', url, body),
    delete: (url) => request('DELETE', url),
  };
})();
