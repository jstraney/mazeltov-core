const {
  string: {
    joinWords,
  },
} = require('../util');

const wrap = require('./wrap');

// Send a transactional email using the consuming model result
// TODO: consider use cases where we send alternate e-mails on error
// or if there is no result. What if we need to send multiple emails?
module.exports = ( config = {} ) => {

  // Right now a sendinblueClient will be passed as emailService
  // as we will use service in future. The future emailService
  // (under lib.js.service/email) will have same interface
  const {
    emailTemplate = null,
    emailLocals = {},
    subject = '',
    bcc = [],
    cc = [],
    // can be 'result', or 'arg'
    getToFrom = 'result',
    to = [],
    toKey = null,
    toIsArray = false,
    logger = global.console,
    services,
  } = config;

  const {
    emailService = null,
  } = services;

  if (!['result', 'arg'].includes(getToFrom)) {
    throw new Error('getToFrom has to be "result" or "arg"');
  }

  [
    [getToFrom, 'getToFrom'],
    [emailTemplate, 'emailTemplate'],
    [emailService, 'emailService'],
  ].forEach(([arg, label]) => {
    if (!arg) {
      throw new Error(`${label} is required for sendEmail middleware`);
    }
  });

  return wrap(async function sendEmail (req, res, next) {

    const {
      result,
    } = res.locals;

    if (result) {

      if (toKey) {

        const recipient = getToFrom === 'result'
          ? result[toKey]
          : req.args[toKey];

        to.push(recipient);

      }

      if (!to.length) {
        logger.warn('No recipients in "to" array for sendEmail');
        return next();
      }

      logger.debug('sending mail to %s', joinWords(to));

      try {

        emailService.sendEmail({
          emailTemplate,
          templateLocals: {
            ...req.app.locals,
            ...res.locals,
            ...emailLocals
          },
          subject,
          to,
          cc,
          bcc,
        });

      // error not attached to res.locals as it
      // could trigger an unintential error response downstream
      // and emails are usually a secondary action of some other
      // primary web/cli controlled action.
      } catch (error) {

        logger.error('%o', error);

      }

    }

    next();

  });

}
