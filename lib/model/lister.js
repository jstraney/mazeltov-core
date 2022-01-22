const {
  pascalCase
} = require('change-case');

const {
  type: {
    isArray,
    isFunction,
    isObject,
  },
  collection: {
    arrayIntersect,
    buildArray,
    lookupMap,
  },
} = require('../util');


const {
  _joinsAreValid,
  _makeAliasLookup,
  _makeKeys,
  _makeProfileId,
  _makeSelectArgs,
  _resolveAlias,
  _select,
  makeWhereBuilder,
  applyDateRange,
} = require('./util');

/**
 * on page 3, total pages 5
 * 1, 2, _3_, 4, 5
 * on page 3, total pages 12
 * 1, 2, _3_, 4, 5, 6, 7, 8, 9, 10, 11
 * on page 22, total pages 100
 * 17, 18, 19, 20, 21, _22_, 23, 24, 25, 26, 27
 * on page 97, total pages 100
 * 90, 91, 92, 93, 94, 95, 96, _97_, 98, 99, 100
 */
const buildLocalPages = (currentPage, totalPages, maxVisiblePages = 10) => {
  const pagesShown = Math.min(totalPages, maxVisiblePages);
  return buildArray(pagesShown, (i) => {
    if (currentPage < Math.ceil(maxVisiblePages / 2)) {
      return i + 1;
    } else if (totalPages - currentPage <= maxVisiblePages) {
      return i + 1 + totalPages - pagesShown;
    }
    return i + 1 + currentPage - Math.ceil(maxVisiblePages / 2);
  });
}
/*
 * A lister returns a list of records and is always
 * paginated!
 */
module.exports = ( ctx = {} ) => {

  const {
    db,
    entityInfo,
    logger,
    fnName = 'list',
    selectColumns = [],
    orderable = [],
    onListResult = null,
    joins = [],
    listPageLimit = 10,
  } = ctx;

  const {
    entityName,
    pascalEntity,
    key = ['id'],
    schema = 'public',
  } = entityInfo;

  let {
    onBuildListWhere = null,
  } = ctx;

  if (!selectColumns.length) {
    logger.warn('%s%s has no select columns. Was that intentional?', fnName, pascalEntity);
  }

  const
  keys       = _makeKeys(key),
  orderableLookup = lookupMap(orderable),
  selectArgs = _makeSelectArgs(selectColumns, entityName),
  useJoins   = _joinsAreValid(joins),
  useBuildListWhereHook = isFunction(onBuildListWhere) || isObject(onBuildListWhere),
  useListResultHook     = isFunction(onListResult),
  aliasLookup           = _makeAliasLookup(selectArgs);

  if (isObject(onBuildListWhere)) {
    onBuildListWhere = makeWhereBuilder(onBuildListWhere);
  }

  const list = async function ( args = {} ) {

    logger.info('%s%s: %o', fnName, pascalEntity, args);

    const profileId = _makeProfileId(args, fnName, pascalEntity);
    logger.profile(profileId);

    const {
      page: maybeStringPage = 1,
      limit: maybeStringLimit  = listPageLimit,
      orderBy = [],
      ...restArgs
    } = args;

    const page = Number.parseInt(maybeStringPage);
    const limit = Number.parseInt(maybeStringLimit);

    const orderDir = isArray(args.orderBy) && args.orderBy.length > 0
      ? orderBy.map((_, i) => args.orderDir[i] || 'asc')
      : [];

    const offset = (page - 1) * limit;

    const whereFunc = (builder) => {
      if (useBuildListWhereHook) {
        onBuildListWhere(builder, args, aliasLookup);
      }
    };

    try {

      const resultQuery = _select(
        db.withSchema(schema),
        selectArgs,
        entityName,
        joins,
        useJoins,
        whereFunc
      )
      .limit(limit)
      .offset(offset)

      if (orderBy.length) {
        for (let i = 0; i < orderBy.length; i++) {
          const orderCol = orderBy[i];
          if (!orderableLookup[orderCol]) {
            logger.debug('%s col is not orderable', orderCol);
            continue;
          }
          const ascOrDesc = orderDir[i];
          const alias = _resolveAlias(orderCol, aliasLookup, entityName);
          resultQuery.orderBy(alias, ascOrDesc);
        }
      }

      // check if there is not an order on any keys and apply
      // one if there isn't. This ensures a guaranteed order
      // in results and breaks ties for pagination.
      // TLDR; if there is not a sort on unique key in Postgres
      // pagination can break because the DB will return results
      // in whatever order it feels like.
      if (arrayIntersect(keys, orderBy).length === 0) {
        for (const key of keys) {
          resultQuery.orderBy(key, 'asc');
        }
      }

      const [
        result,
        total,
      ] = await Promise.all([
        resultQuery.catch((error) => {
          logger.error('error on _select: %o', error);
          return [];
        }),
        // total
        _select(
          db.withSchema(schema),
          [],
          entityName,
          joins,
          useJoins,
          whereFunc
        ).count('* AS total')
          .then(([ row = {total: 0} ]) => Number.parseInt(row.total))
          .catch((error) => {
            logger.error('error on getting total: %o', error);
          }),
      ])

      const totalPages = Math.ceil(total / limit);

      const localPages = buildLocalPages(page, totalPages)

      // return pagination info, results, and total for stupid
      // easy client side consumption (no weird client maths/checks)
      const response = {
        result,
        total,
        limit,
        currentPage: page,
        localPages,
        totalPages,
        nextPage: page < totalPages && totalPages > 1 ? page + 1 : null,
        prevPage: page > 1 && totalPages > 1 ? page - 1 : null,
        firstPage: totalPages > 0 && page > 1 ? 1 : null,
        lastPage: totalPages > 0 && page < totalPages ? totalPages : null,
      };

      logger.profile(profileId);

      return useListResultHook
        ? onListResult(response)
        : response;

    } catch (error) {

      logger.error('%o', error);

      return {
        result: [],
        total: 0,
        totalPages: 0,
        limit,
        firstPage: null,
        lastPage: null,
        localPages: [],
        currentPage: page,
        nextPage: null,
        prevPage: null,
      };

    }

  };

  if (fnName !== 'list') {
    Object.defineProperty(list, 'name', { value: fnName });
  }

  return list;

};
