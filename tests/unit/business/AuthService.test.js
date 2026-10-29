const AuthService = require('../../../src/business/services/AuthService');
const { ValidationError, UnauthorizedError } = require('../../../src/business/errors/AppError');
const SessionRepository = require('../../../src/data-access/repositories/SessionRepository');
const PasswordHasher = require('../../../src/data-access/security/PasswordHasher');
const { InMemoryUserRepository } = require('../helpers/inMemoryRepositories');

describe('AuthService', () => {
  const passwordHasher = new PasswordHasher();
  let service;
  let sara;

  beforeEach(() => {
    const userRepository = new InMemoryUserRepository();
    sara = userRepository.create({
      name: 'Sara',
      email: 'sara@taskflow.test',
      passwordHash: passwordHasher.hash('secret123'),
    });
    service = new AuthService({
      userRepository,
      sessionRepository: new SessionRepository(),
      passwordHasher,
    });
  });

  it('logs in with the right details and returns a token and the user without passwordHash', () => {
    const result = service.login({ email: 'sara@taskflow.test', password: 'secret123' });

    expect(typeof result.token).toBe('string');
    expect(result.user).toEqual({ id: sara.id, name: 'Sara', email: 'sara@taskflow.test' });
  });

  it('rejects a wrong password with UnauthorizedError', () => {
    expect(() => service.login({ email: 'sara@taskflow.test', password: 'nope' })).toThrow(
      new UnauthorizedError('Wrong email or password'),
    );
  });

  it('gives an unknown email the same message as a wrong password', () => {
    expect(() => service.login({ email: 'ghost@taskflow.test', password: 'secret123' })).toThrow(
      new UnauthorizedError('Wrong email or password'),
    );
  });

  it('requires both email and password', () => {
    expect(() => service.login({ email: 'sara@taskflow.test' })).toThrow(
      new ValidationError('Email and password are required'),
    );
    expect(() => service.login({ password: 'secret123' })).toThrow(ValidationError);
  });

  it('finds the user by token', () => {
    const { token } = service.login({ email: 'sara@taskflow.test', password: 'secret123' });

    expect(service.getUserByToken(token)).toEqual({
      id: sara.id,
      name: 'Sara',
      email: 'sara@taskflow.test',
    });
  });

  it('rejects the token after logout', () => {
    const { token } = service.login({ email: 'sara@taskflow.test', password: 'secret123' });

    service.logout(token);

    expect(() => service.getUserByToken(token)).toThrow(new UnauthorizedError('Please log in'));
  });

  it('rejects a missing or unknown token', () => {
    expect(() => service.getUserByToken(undefined)).toThrow(new UnauthorizedError('Please log in'));
    expect(() => service.getUserByToken('made-up')).toThrow(UnauthorizedError);
  });
});
