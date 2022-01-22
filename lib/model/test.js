const chalk = require('chalk');

const {
  collection: {
    subObject,
  },
  dev: {
    EXPECTS_NO_IN,
    EXPECTS_NO_OUT,
    RETURN_SELF,
    EXPECTS_FN_IN,
    RETURN_PROMISE,
    RETURN_COMPUTED,
    printR,
  },
  error: {
    ConflictError,
    NotFoundError,
  },
} = require('../util')

// Traces the calls used in _select helper method which appears
// in getters, listers, and more. Because the result from _select
// could be thenned, or could have knex methods (limit, offset) called,
// there is an option to return the knex mock or a promise with result
const _selectDbTrace = (model, result, thenned = true) => {

  const {
    _entityName,
    _selectArgs,
    _joinTypesOrdered,
  } = model;

  const joinCalls = _joinTypesOrdered.map((joinType, i) => {

    if (thenned) {
      return i < _joinTypesOrdered.length - 1
        ? [joinType, undefined, undefined, [EXPECTS_NO_IN, RETURN_SELF]]
        : [joinType, undefined, result, [EXPECTS_NO_IN, RETURN_PROMISE]];
    }

    return [joinType, undefined, result, [EXPECTS_NO_IN, RETURN_SELF]];

  });

  if (thenned) {
    return [
      ['select', _selectArgs, undefined, [RETURN_SELF]],
      ['from', _entityName, undefined, [RETURN_SELF]],
      [
        'where',
        undefined,
        result,
        [
          EXPECTS_FN_IN,
          joinCalls.length ? RETURN_SELF: RETURN_PROMISE
        ]
      ],
      ...joinCalls,
    ];
  }

  return [
    ['select', _selectArgs, undefined, [RETURN_SELF]],
    ['from', _entityName, undefined, [RETURN_SELF]],
    [
      'where',
      undefined,
      result,
      [
        EXPECTS_FN_IN,
        RETURN_SELF
      ]
    ],
    ...joinCalls,
  ];

};

const creatorDbTrace = (model, createArgs, result, fakeDupError = false) => {

  if (fakeDupError) {
    return [
      ['returning', undefined, undefined, [EXPECTS_NO_IN, RETURN_SELF]],
      [
        'insert',
        createArgs,
        () => {
          const e = new Error('something something dup key error');
          e.code = '23505';
          throw e;
        },
        [
          EXPECTS_NO_IN,
          RETURN_COMPUTED,
        ]
      ],
    ];
  }

  return [
    ['returning', undefined, undefined, [EXPECTS_NO_IN, RETURN_SELF]],
    ['insert', createArgs, [result], [EXPECTS_NO_IN, RETURN_PROMISE]],
    ..._selectDbTrace(model, [result]),
  ];

};

const getterDbTrace = (model, result) => {
  return [
    ..._selectDbTrace(model, result),
  ];
};

const updaterDbTrace = (model, whereArgs, result) => {
  return [
    ['update', undefined, undefined, [EXPECTS_NO_IN, RETURN_SELF]],
    ['where', whereArgs, undefined, [RETURN_SELF]],
    ..._selectDbTrace(model, result),
  ];
};

const removerDbTrace = (model, whereArgs, extant, numRemoved) => {
  return [
    ['select', model._keys, undefined, [RETURN_SELF]],
    ['from', model._entityName, undefined, [RETURN_SELF]],
    ['where', whereArgs, [extant], [RETURN_PROMISE]],
    ['where', whereArgs, undefined, [RETURN_SELF]],
    ['del', undefined, numRemoved, [EXPECTS_NO_IN, RETURN_PROMISE]],
  ];
};

const listerDbTrace = (model, result, summary) => {
  // TODO: is it important to "assert" limit and offset?
  return [
    ..._selectDbTrace(model, result, false),
    ['limit', undefined, undefined, [EXPECTS_NO_IN, RETURN_SELF]],
    ['offset', undefined, result, [EXPECTS_NO_IN, RETURN_PROMISE]],
    ['count', '* AS total', undefined, [RETURN_SELF]],
    ['where', undefined, summary, [EXPECTS_FN_IN, RETURN_PROMISE]],
  ];
};

const buildCreatorTests = (model, factory) => {

  const instance = factory();

  return [
    `create${model._pascalName}`,
    [
      [instance],
      {
        db: creatorDbTrace(model, instance, [instance]),
      },
      EXPECTS_NO_OUT,
    ],
    [
      [instance],
      {
        db: creatorDbTrace(model, instance, [instance], true),
      },
      ConflictError,
    ],
  ];

}

const buildGetterTests = (model, factory) => {

  const instance = factory();

  return [
    `get${model._pascalName}`,
    [
      [subObject(instance, model._keys)],
      {
        db: getterDbTrace(model, [instance]),
      },
      instance,
    ],
    [
      [subObject(instance, model._keys)],
      {
        db: getterDbTrace(model, []),
      },
      null,
    ],
  ];

};

const buildUpdaterTests = (model, factory) => {

  const instance = factory();

  const input = subObject(instance, model._keys);

  return [
    `update${model._pascalName}`,
    [
      [input],
      {
        db: updaterDbTrace(model, input, [instance]),
      },
      instance,
    ],
  ];

}

const buildRemoverTests = (model, factory) => {

  const instance = factory();

  const input = subObject(instance, model._keys);

  return [
    `remove${model._pascalName}`,
    [
      [input],
      {
        db: removerDbTrace(model, input, instance, 1),
      },
      { numRemoved: 1 }
    ],
    [
      [input],
      {
        db: removerDbTrace(model, input, null, 0),
      },
      ConflictError,
    ]
  ];

}

const buildListerTests = (model, factory) => {

  const instance = factory();

  const where = subObject(instance, model._keys);

  return [
    `list${model._pascalName}`,
    [
      [{ ...where, page: 0, limit: 12 }],
      {
        db: listerDbTrace(model, [], [{ total: 0 }]),
      },
      {
        total: 0,
        result: [],
        limit: 12,
        currentPage: 0,
        totalPages: 0,
        localPages: [],
        lastPage: null,
        firstPage: null,
        nextPage: null,
        prevPage: null,
      },
    ]
  ];

}

const buildModelTests = (model, factory, testBuilders = [], extraTests = []) => {
  return [
    ...testBuilders.flatMap((fn) => fn(model, factory)),
    ...extraTests,
  ];
}

module.exports = {
  buildCreatorTests,
  buildGetterTests,
  buildListerTests,
  buildModelTests,
  buildRemoverTests,
  buildUpdaterTests,
  creatorDbTrace,
  getterDbTrace,
  listerDbTrace,
  removerDbTrace,
  updaterDbTrace,
};
