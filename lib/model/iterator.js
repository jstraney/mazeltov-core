const {
  pascalCase,
} = require('change-case');
/*
 * An iterator will automatically paginate on a table.
 * This is not useful for HTTP consumers, but is useful
 * for CLI consumers that may want to "walk" a table.
 * The iterator will use a list method and walk until
 * all rows are done. The great thing about this is that
 * by using pages, it will manage memory appropriately
 */
module.exports = ( ctx = {} ) => {

  const {
    entityName,
    pascalEntity = pascalCase(entityName),
    fnName = 'iterate',
    listMethod = null,
    startPage = 0,
    pageLimit = 100,
    maxIterations = 10000,
    timeout = 30 * 60 * 1000,
    logger,
  } = ctx;

  if (isNotFunction(listMethod)) {
    throw new TypeError('%s%s requires listMethod to be a function', fnName, pascalEntity);
  }

  const iterate = async function (args, cb) {

    logger.info('%s over %s in pages of %s', fnName, entityName, pageLimit);

    let iterations = 0, page = startPage;

    const taskTimeout = global.setTimeout(() => {
      throw new Error(fmt('%s%s timeout of %s exceeded', fnName, pascalEntity, timeout));
    }, timeout);

    while (iterations < maxIterations) {

      const listResult = await listMethod({
        ...args,
        page,
        limit: pageLimit,
      });

      const {
        total,
        currentPage,
        result: records,
        nextPage,
      } = listResult;

      await cb(records);

      if (nextPage === null) {
        break;
      } else if (page === nextPage) {
        logger.warn(
          'List returned same page as next page %s%s. Look into this!',
          fnName,
          pascalEntity
        );
        break;
      } else {
        page = nextPage;
      }

      iterations++;

    }

    clearTimeout(taskTimeout);

  };

  if (fnName !== 'iterate') {
    Object.defineProperty(iterate, 'name', { value: fnName });
  }

  return iterate;

}
