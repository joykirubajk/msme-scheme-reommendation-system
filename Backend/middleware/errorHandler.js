import { fail } from '../utils/response.js';

export const notFound = (req, res) => {
  fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

// Express error handler (4 args). Never sends stack traces or raw DB errors to clients.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return fail(res, 400, 'Invalid JSON in request body');
  }

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;

  if (status >= 500) {
    console.error('Unhandled error:', err);
    return fail(res, 500, 'Internal server error');
  }
  return fail(res, status, err.message || 'Request failed');
};
