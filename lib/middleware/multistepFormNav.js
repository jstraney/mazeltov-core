// allows redirecting based on submitted form values
module.exports = (config = {}) => {

  const {
    submitKey = 'op',
    backValue = 'Back',
    nextValue = 'Next',
    backUri = null,
    nextUri = null,
    logger = global.console,
  } = config;

  if (!backUri) {
    throw new Error('backUri is required for multistepFormNav');
  }

  if (!nextUri) {
    throw new Error('nextUri is required for multistepFormNav');
  }

  return async (req, res) => {

    const submitValue = req.method === 'get'
      ? req.query[submitKey]
      : req.body[submitKey];

    if (submitValue === backValue) {

      logger.debug('form navigating back to: %s', backUri);

      return res.redirect(backUri);

    } else if (submitValue === nextValue) {

      logger.debug('form navigating forward to: %s', nextUri);

      return res.redirect(nextUri);

    }

    logger.debug('form navigation unclear. refreshing', nextUri);

    return res.redirect('back');

  };

}
