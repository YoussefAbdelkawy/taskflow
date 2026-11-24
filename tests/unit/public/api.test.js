// Runs public/js/api.js in a sandbox with a fake fetch, localStorage and location,
// because the frontend has no build step and Jest has no browser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const API_FILE = path.join(__dirname, '../../../public/js/api.js');
const TOKEN_KEY = 'taskflow.token';

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const brokenStorage = () => ({
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
});

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function loadApi({
  storage = fakeStorage(),
  pathname = '/index.html',
  search = '',
  response,
  fetchError,
}) {
  const calls = [];
  const location = { pathname, search, href: pathname };
  const sandbox = {
    localStorage: storage,
    location,
    URLSearchParams,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (fetchError) throw fetchError;
      return response;
    },
  };
  vm.createContext(sandbox);
  const api = vm.runInContext(`${fs.readFileSync(API_FILE, 'utf8')}\napi;`, sandbox);
  return { api, calls, location, storage };
}

describe('public/js/api.js', () => {
  it('keeps get and post working', async () => {
    const { api, calls } = loadApi({ response: jsonResponse(200, { status: 'ok' }) });

    await expect(api.get('/health')).resolves.toEqual({ status: 'ok' });
    await api.post('/auth/login', { email: 'a' });

    expect(calls[0]).toMatchObject({ url: '/api/health', options: { method: 'GET' } });
    expect(calls[1].options).toMatchObject({ method: 'POST', body: '{"email":"a"}' });
  });

  it.each([
    ['put', 'PUT'],
    ['patch', 'PATCH'],
    ['delete', 'DELETE'],
  ])('has %s()', async (name, method) => {
    const { api, calls } = loadApi({ response: jsonResponse(200, {}) });

    await api[name]('/tasks/1/recurrence', name === 'delete' ? undefined : { frequency: 'DAILY' });

    expect(calls[0].options.method).toBe(method);
  });

  it('stores the token under taskflow.token and sends it as a Bearer header', async () => {
    const { api, calls, storage } = loadApi({ response: jsonResponse(200, {}) });

    api.setToken('abc');
    await api.get('/auth/me');

    expect(storage.getItem(TOKEN_KEY)).toBe('abc');
    expect(calls[0].options.headers.Authorization).toBe('Bearer abc');
  });

  it('sends no Authorization header without a token', async () => {
    const { api, calls } = loadApi({ response: jsonResponse(200, {}) });

    await api.get('/health');

    expect(calls[0].options.headers).not.toHaveProperty('Authorization');
  });

  it('clearToken removes the token', () => {
    const { api, storage } = loadApi({ storage: fakeStorage({ [TOKEN_KEY]: 'abc' }) });

    api.clearToken();

    expect(storage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('on 401 clears the token, goes to login.html?next=<this page> and throws', async () => {
    const { api, location, storage } = loadApi({
      storage: fakeStorage({ [TOKEN_KEY]: 'old' }),
      pathname: '/task.html',
      search: '?id=3',
      response: jsonResponse(401, { error: 'Please log in' }),
    });

    await expect(api.get('/auth/me')).rejects.toThrow('Please log in');

    expect(storage.getItem(TOKEN_KEY)).toBeNull();
    expect(location.href).toBe('login.html?next=task.html%3Fid%3D3');
  });

  it('on 401 while already on login.html stays there and shows the server message', async () => {
    const { api, location } = loadApi({
      pathname: '/login.html',
      response: jsonResponse(401, { error: 'Wrong email or password' }),
    });

    await expect(api.post('/auth/login', {})).rejects.toThrow('Wrong email or password');

    expect(location.href).toBe('/login.html');
  });

  it('throws the server error text for other failures', async () => {
    const { api } = loadApi({ response: jsonResponse(403, { error: 'Only a manager can' }) });

    await expect(api.put('/tasks/1/recurrence', {})).rejects.toThrow('Only a manager can');
  });

  it('handles a 204 response with no body', async () => {
    const response = {
      ok: true,
      status: 204,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    };
    const { api } = loadApi({ response });

    await expect(api.post('/auth/logout')).resolves.toBeNull();
  });

  it('keeps working when localStorage is blocked', async () => {
    const { api } = loadApi({ storage: brokenStorage(), response: jsonResponse(200, {}) });

    expect(() => api.setToken('abc')).not.toThrow();
    expect(() => api.clearToken()).not.toThrow();
    await expect(api.get('/health')).resolves.toEqual({});
  });

  describe('error contract (M3)', () => {
    it('a non-2xx answer throws an ApiError with status, message and the whole body as details', async () => {
      const body = { error: 'Task is blocked', blockedBy: [4] };
      const { api } = loadApi({ response: jsonResponse(409, body) });

      const error = await api.patch('/tasks/1/status', {}).catch((thrown) => thrown);

      expect(error).toBeInstanceOf(api.ApiError);
      // the sandbox has its own Error class, so check the parent by name
      expect(Object.getPrototypeOf(api.ApiError.prototype).constructor.name).toBe('Error');
      expect(error).toMatchObject({ status: 409, message: 'Task is blocked', details: body });
    });

    it('an answer without a JSON body still gives a readable message', async () => {
      const response = { ok: false, status: 500, json: async () => JSON.parse('<html>') };
      const { api } = loadApi({ response });

      await expect(api.get('/health')).rejects.toMatchObject({
        status: 500,
        message: 'Request failed (500)',
      });
    });

    it('a network failure throws ApiError(0, "Cannot reach the server")', async () => {
      const { api } = loadApi({ fetchError: new TypeError('Failed to fetch') });

      const error = await api.get('/health').catch((thrown) => thrown);

      expect(error).toBeInstanceOf(api.ApiError);
      expect(error).toMatchObject({ status: 0, message: 'Cannot reach the server' });
    });

    it('on login.html, 401 does not add a next parameter to itself', async () => {
      const { api, location } = loadApi({
        pathname: '/login.html',
        search: '?next=index.html',
        response: jsonResponse(401, { error: 'Wrong email or password' }),
      });

      await expect(api.post('/auth/login', {})).rejects.toThrow('Wrong email or password');
      expect(location.href).toBe('/login.html');
    });
  });

  describe('download (US7-2)', () => {
    const fileResponse = (disposition) => ({
      ok: true,
      status: 200,
      headers: { get: (name) => (name === 'Content-Disposition' ? disposition : null) },
      blob: async () => 'file-bytes',
      json: async () => ({}),
    });

    it.each([
      ['attachment; filename="taskflow-website-2026-11-24.csv"', 'taskflow-website-2026-11-24.csv'],
      ['attachment; filename=taskflow-a-2026-11-24.csv', 'taskflow-a-2026-11-24.csv'],
      [null, 'download'],
    ])('US7-2 reads the file name from %p', async (disposition, fileName) => {
      const { api, calls } = loadApi({
        storage: fakeStorage({ [TOKEN_KEY]: 'abc' }),
        response: fileResponse(disposition),
      });

      await expect(api.download('/projects/1/report.csv')).resolves.toEqual({
        blob: 'file-bytes',
        fileName,
      });
      expect(calls[0].options.headers.Authorization).toBe('Bearer abc');
    });

    it('US7-2 a refused download throws the server error like every other call', async () => {
      const { api } = loadApi({
        response: jsonResponse(403, { error: 'Only the project manager' }),
      });

      await expect(api.download('/projects/1/report.csv')).rejects.toMatchObject({ status: 403 });
    });
  });
});
