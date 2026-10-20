/**
 * Errors that services throw when a business rule is broken (Lab 2: fail fast).
 * Services NEVER send HTTP responses. They throw one of these, and the error
 * middleware in the presentation layer turns it into the right status code.
 *
 * Usage inside a service:
 *   if (!input.title) throw new ValidationError('Title is required');
 */
class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Input is missing or invalid (becomes HTTP 400). */
class ValidationError extends AppError {}

/** The user is not allowed to do this (becomes HTTP 403). */
class ForbiddenError extends AppError {}

/** The thing asked for does not exist (becomes HTTP 404). */
class NotFoundError extends AppError {}

/** The action clashes with the current state, e.g. a duplicate (becomes HTTP 409). */
class ConflictError extends AppError {}

module.exports = { AppError, ValidationError, ForbiddenError, NotFoundError, ConflictError };
