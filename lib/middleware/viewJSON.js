const {
  handleRequestError
} = require('./errorHandlers');

const wrap = require('./wrap');

module.exports = ( config = {} ) => {

  /*
   * A decorator is a function that accepts the results
   * payload and wraps it with extra content. An example of this
   * could be HATEOAS links or a summary of query totals.
   */
  const {
    decorator = null,
    logger = global.console,
  } = config;

  if (decorator && typeof decorator !== 'function') {
    throw new Error('viewJSON decorator must be a function if supplied');
  }

  return wrap(async function viewJSON (req, res) {

    const { result, error} = res.locals;

    logger.debug('viewJSON: %o', {result, error});

    try {

      if (error) {

        return handleRequestError(req, res, error);

      } else if (result) {

        return decorator === null
          ? res.json(result)
          : res.json(( await decorator(result, req, res)));

      }

    } catch (error) {

      logger.error('Unhandled error in viewJSON: %o', error);
      return handleRequestError(req, res, error);

    }

    res.end();

  });

}
