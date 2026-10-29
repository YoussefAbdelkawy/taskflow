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

function loadApi({ storage = fakeStorage(), pathname = '/index.html', response }) {
  const calls = [];
  const location = { pathname, href: pathname };
  const sandbox = {
    localStorage: storage,
    location,
    fetch: async (url, options) => {
      calls.push({ url, options });
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

  it('on 401 clears the token, goes to login.html and throws', async () => {
    const { api, location, storage } = loadApi({
      storage: fakeStorage({ [TOKEN_KEY]: 'old' }),
      response: jsonResponse(401, { error: 'Please log in' }),
    });

    await expect(api.get('/auth/me')).rejects.toThrow('Please log in');

    expect(storage.getItem(TOKEN_KEY)).toBeNull();
    expect(location.href).toBe('login.html');
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
});
