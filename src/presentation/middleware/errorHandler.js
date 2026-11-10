// Turns errors thrown by services into HTTP responses.
// Because of this file, controllers do not need try/catch: Express 5 forwards
// any thrown error here automatically.
const HTTP_STATUS = Object.freeze({
  ValidationError: 400,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
});
const BAD_REQUEST = 400;
const INTERNAL_SERVER_ERROR = 500;
// What express.json() reports when the request body is not valid JSON
const MALFORMED_JSON = 'entity.parse.failed';
const isMalformedJson = (error) => error.type === MALFORMED_JSON;

// Lab 4: pattern matching with a lookup table instead of a long if/else chain.
const statusFor = (error) => {
  if (isMalformedJson(error)) return BAD_REQUEST;
  return HTTP_STATUS[error.name] ?? INTERNAL_SERVER_ERROR;
};

const messageFor = (error, status) => {
  if (isMalformedJson(error)) return 'Request body must be valid JSON';
  return status === INTERNAL_SERVER_ERROR ? 'Something went wrong' : error.message;
};

// Express recognises error middleware by its 4 parameters, so `_next` must stay.
// eslint-disable-next-line max-params
function errorHandler(error, _req, res, _next) {
  const status = statusFor(error);
  if (status === INTERNAL_SERVER_ERROR) console.error(error);

  res.status(status).json({ error: messageFor(error, status) });
}

module.exports = { errorHandler, statusFor };
