const { statusFor } = require('../../../src/presentation/middleware/errorHandler');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} = require('../../../src/business/errors/AppError');

describe('errorHandler.statusFor', () => {
  it.each([
    [new ValidationError('bad input'), 400],
    [new UnauthorizedError('Please log in'), 401],
    [new ForbiddenError('not allowed'), 403],
    [new NotFoundError('missing'), 404],
    [new ConflictError('duplicate'), 409],
    [new Error('unexpected'), 500],
  ])('maps %s to HTTP %i', (error, expectedStatus) => {
    expect(statusFor(error)).toBe(expectedStatus);
  });
});
