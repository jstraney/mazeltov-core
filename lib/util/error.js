const {
  isArray,
  isObject,
} = require('./type');

const _exports = [
  // 400
  class BadRequestError extends Error {
    code = 400;
    key = '_badRequest';
    constructor (message, list, ...rest) {
      super(message, ...rest);
      if (list && isArray(list)) {
        this.list = list;
        this.lookup = list.reduce((o, e) => ({
          ...o,
          [e.key]: true,
        }), {});
      }
    }
  },
  class UnauthorizedError extends Error {
    code = 401;
    key = '_unauthorized';
  },
  class ForbiddenError extends Error {
    code = 403;
    key = '_forbidden';
  },
  class NotFoundError extends Error {
    code = 404;
    key = '_notFound';
  },
  class ConflictError extends Error {
    code = 409;
    key = '_conflict';
  },
  class GoneError extends Error {
    code = 410;
    key = '_gone';
  },
  class UnprocessableEntityError extends Error {
    code = 422;
    key = '_unprocessableEntity';
  },
  // 500
  class ServerError extends Error {
    code = 500;
    key = '_serverError';
  },
  class BadGatewayError extends Error {
    code = 502;
    key = '_badGateway';
  },
  class ServiceUnavailableError extends Error {
    code = 503;
    key = '_serviceUnavailable';
  },
  class GatewayTimeoutError extends Error {
    code = 504;
    key = '_gatewayTimeout';
  },
].reduce((exp, cls) => ({
  ...exp,
  [cls.name] : cls,
}), {});

const isRedirectCode = (code) => code >= 300 && code < 400
const isUserErrorCode = (code) => code >= 400 && code < 500
const isServerErrorCode = (code) => code >= 500;
const isStatusCode = (code) => /^[1-5](?:0[0-9]|[1-9][0-9])$/.test(code);

const getHttpErrorStatusCode = (err) => {
  return isStatusCode(err.code) ? err.code : 500;
};

const isSuccessCode = (code) => code >= 200 && code < 300

module.exports = {
  ..._exports,
  getHttpErrorStatusCode,
  isSuccessCode,
  isRedirectCode,
  isUserErrorCode,
  isServerErrorCode,
};
