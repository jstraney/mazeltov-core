const chalk = require('chalk');

const {
  format: fmt,
} = require('util')

const {
  objectMapper,
} = require('./map')

const {
  lookupMap,
  uniqueArray,
} = require('./collection');

const {
  autoPad,
  list,
} = require('./string');

const {
  isFunction,
  isNotFunction,
  isUndefined,
  isArray,
  isObject,
  isNumber,
  isNotObject,
} = require('./type');


/*
 * The utilities in this module are specifically for testing
 * and shouldn't be used in "running" code where assert is used
 */
const assert = require('assert');

/*
 * A tracer is most useful for passing into mock objects.
 * See the mockDB created for lib.js.model as an example.
 */
const tracer = (logger) => {

  let stack = [];

  const push = (...args) => stack.push(args);

  const clear = () => stack = [];

  const get = (i) => stack[i] !== undefined ? stack[i] : null;

  const trace = (label = 'stack', expected = []) => {
    logger.debug('Checking %s call trace', label)
    for (let i = 0; i < trace.length; i++) {
      assert.deepEqual(expected[i], trace[i]);
    }
    logger.debug('%s has expected call values', label);
  };

  return {
    push,
    trace,
    clear,
  }

}

class TestStub {

  constructor (iface, logger, assert) {

    let closure;

    this.iface = iface;

    this.logger = logger;
    this.assert = assert;

    this.makeIfaceProxy = this.makeIfaceProxy.bind(this);
    this.resetStub = this.resetStub.bind(this);
    this._getNextGenerator = this._getNextGenerator.bind(this);
    this._stub = {};
    this.makeIfaceProxy();

    this.iface._ref = this;

    /*
     * Original implementation used ES6 Proxy until it was
     * discovered too late that ES6 Proxy is not awaitable (fun)!
     * So no, Proxy was not suitable at time of implementation.
     */
    return this;

  }

  *_getNextGenerator(calls) {
    for (const call of calls) {
      yield call;
    }
  }

  makeIfaceProxy() {
    for (const key in this.iface) {
      if (isFunction(this.iface[key])) {
        this[key] = (...args) => {

          return this._stub[key] && isFunction(this._stub[key])
            ? this._stub[key](...args)
            : this.iface[key](...args);

        }
      }
    }
  }

  resetStub(nextCalls) {

    const generator = this._getNextGenerator(nextCalls);

    const _stub = {};

    for (const [fnName] of nextCalls) {

      if (_stub[fnName]) {
        continue;
      }

      _stub[fnName] = (actualIn, ...restActual) => {

        const actualCall = generator.next().value;

        if (actualCall === undefined) {
          return;
        }

        const [
          expectedFnName,
          expectedIn,
          result,
          flags = [],
        ] = actualCall;

        this.assert.deepEqual(fnName, expectedFnName);

        let expectedInR;

        if (flags.includes(EXPECTS_FN_IN)) {
          // I cannot see how to account for all the possible
          // things that get passed into the callback so just
          // asserting a function was recieved
          this.assert.strictEqual(typeof actualIn, 'function');
          expectedInR = printR(() => {});
        } else if (flags.includes(SPREAD_IN)) {

          this.assert.deepEqual([actualIn, ...restActual], expectedIn);
          expectedInR = printR(list(expectedIn));

        } else if (!flags.includes(EXPECTS_NO_IN)) {
          this.assert.deepEqual(actualIn, expectedIn);
          expectedInR = printR(expectedIn);
        } else {
          expectedInR = printR();
        }

        if (flags.includes(RETURN_SELF)) {

          this.logger.debug(
            'stub called %s(%s) chaining self',
            fnName,
            expectedInR,
          );

          return this;

        } else if (flags.includes(RETURN_COMPUTED)) {

          if (isNotFunction(result)) {
            throw new TypeError([
              'expected result must be a function to',
              'compute the return value. got',
              printR(typeof result),
            ].join());
          }

          this.logger.debug(
            'stub called %s(%s). Computing returned value',
            fnName,
            expectedInR,
          );

          return result();

        } else if (flags.includes(RETURN_PROMISE)) {

          this.logger.debug(
            'stub called %s(%s) returning promise',
            fnName,
            expectedInR,
          );

          return Promise.resolve(result);

        }

        this.logger.debug(
          'stub called %s(%s) returning %s',
          fnName,
          expectedInR,
          printR(result)
        )

        return result;

      };

    }

    this.logger.debug('Internal stub: %o', _stub);

    this._stub = _stub;

  }

}

// functional interface to OOP class above
const makeStub = (ctx ={}) => {

  const {
    iface = {},
    assert,
    logger,
  } = ctx;

  const stub = new TestStub(iface, logger, assert);

  if (isFunction(iface)) {
    const nextIface = iface.bind(stub);
    Object.assign(nextIface, stub);
    return nextIface;
  }

  return stub;

}

const chainer = (name, logger, mock) => {

  const chain = (...args) => {

    logger.debug('calling chainable method %s: %o', name, args);

    return mock._ref

  };

  chain._chainable = true;

  return chain;

}

/*
 * Because Proxy and async do not mix, we fake thenables
 * (not actually async!)
 */
const thener = (name, logger) => {

  let fn;

  fn = () => {

    logger.debug('calling thenable method %s', name);

    return Promise.resolve();

  };

  fn._thenable = true;

  return fn;

};

const mockIface = (config = {}) => {

  const {
    iface = {},
    ifaceCallable = false,
    chainable = [],
    thenable = [],
    fns = [],
    logger,
  } = config;

  const
  chainableLookup = lookupMap(chainable),
  thenableLookup = lookupMap(thenable);

  const mock = ifaceCallable
    ? () => mock._ref
    : {};

  mock._ref = mock;

  const appendFn = (fnName, wrapImpl = false) => {

    const
    fnChainable = chainableLookup[fnName],
    fnThenable = thenableLookup[fnName];

    if (fnChainable) {
      mock[fnName] = chainer(fnName, logger, mock);
    } else if (fnThenable) {
      mock[fnName] = thener(fnName, logger, mock);
    } else {
      mock[fnName] = (input) => {
        logger.debug('calling method %s: %o', fnName, input);
        if (wrapImpl) {
          return iface[fnName](input);
        }
      }
    }

  }

  for (const fnName in iface) {

    const value = iface[fnName];

    if (isNotFunction(value)) {
      mock[fnName] = value;
      continue;
    }

    appendFn(fnName, true);

  }

  const allFns = uniqueArray(chainable.concat(thenable).concat(fns));

  for (const fnName of allFns) {
    appendFn(fnName);
  }

  return mock;

}

const mockDb = (logger) => mockIface({
  ifaceCallable: true,
  chainable: [
    'count',
    'del',
    'from',
    'groupBy',
    'innerJoin',
    'insert',
    'leftJoin',
    'limit',
    'merge',
    'offset',
    'on',
    'onConflict',
    'returning',
    'rightJoin',
    'select',
    'update',
    'whereRaw',
    'transaction',
    'commit',
    'rollback',
  ],
  thenable: [
    'where',
    'whereIn',
  ],
  logger,
});

const mockNamesiloApi = (logger) => mockIface({
  thenable: [
    'registerDomain',
    'renewDomain',
    'getDomainInfo',
    'addAutoRenewal',
    'removeAutoRenewal',
    'domainLock',
    'domainUnlock',
    'checkRegisterAvailability',
  ],
  logger,
});

const mockIoRedis = (logger) => mockIface({
  thenable: [
    'get',
    'set',
  ],
  logger,
});

const mockRascal = (logger) => mockIface({
  subscribe: () => {
    return {
      on: (eventName, cb) => {
        // TODO: It would be super tight if we could
        // fake RabitMQ messages by triggering cb somehow
        // right now just an empty call.
        //
        // Not sure if best way would be:
        // + passing expected message type from first call and using setTimeout
        // + using EventEmitter and catching here
      },
    };
  },
  thenable: [
    'publish',
  ],
  logger,
});

// TODO: implement.
const mockCloudFlareApi = (logger) => mockIface({
  thenable: [
  ],
  logger,
}, logger);

const _splitIntegrationTests = (linearTests = []) => {
  let testIndex;
  return linearTests.reduce((arr, methodOrCase) => {
    if (typeof methodOrCase === 'string') {
      testIndex = testIndex === undefined ? 0 : testIndex + 1;
      arr.push([methodOrCase]);
    } else if (isArray(methodOrCase)) {
      arr[testIndex].push(methodOrCase);
    }
    return arr;
  }, []);
};

/*
 * Basic integration test form:
 * runIntegrationTests(systemUnderTest, [
 *   'methodName',
 *   [
 *     inputForCase1,
 *     // You can provide 1-n arrays of stubbed calls
 *     {
 *       db: [
 *         ['dbMethodName1', input, output, [...options]],
 *         ['dbdMethodName2', input, output, [...options]],
 *       ],
 *       apiService: [
 *         ['apiMethod1', input, output, [...options]],
 *       ],
 *     }
 *     expectedOutput
 *   ],
 *   [
 *     inputForCase2,
 *     ...
 *   ]
 *   ...
 *   'methodName2',
 *   [
 *     inputForCase1,
 *     ...
 *   ],
 * ], {
 *   assert,
 *   logger,
 *   stubs: {
 *     db,
 *   }
 *   systemName: 'testSystem',
 * })
 *
 * ^^^ The above takes all the pressure of getting the semantic nesting
 * correct off of the test builder and makes a clean interface.
 */
const runIntegrationTests = async (system, systemTests, config = {}) => {

  const {
    assert,
    logger,
    stubs = {},
    systemName = 'System',
  } = config;

  const nextTests = _splitIntegrationTests(systemTests);

  const totalTests = nextTests.length;

  const allTestResults = [];

  logger.info(
    chalk.blue(autoPad(` Testing ${systemName} - ${totalTests} tests `, '#', 80)),
  );

  logger.tab();

  let
  passedTests = 0,
  failedTests = 0;

  for (const systemTest of nextTests) {

    const [ method, ...testCases ] = systemTest;

    const totalCases = testCases.length;

    const results = {
      totalTests: 1,
      passedTests: 0,
      failedTests: 0,
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      passedTestNames: [],
      failedTestNames: [],
    };

    let
    passedCases = 0,
    failedCases = 0;

    logger.info(
      chalk.magenta(autoPad(`Testing ${method} - ${totalCases} Cases`, '-', 80)),
    );

    logger.tab();

    for (const testCase of testCases) {

      const [
        input = [],
        stubTraces = {},
        expected = EXPECTS_NO_OUT,
        options = {}
      ] = testCase;

      logger.info(
        chalk.magenta(`Testing ${method}(${list(input.map(printR))})`),
      );

      const {
        description,
      } = options;

      if (description) {
        logger.info(chalk.gray(description));
      }

      // Reset all the stubbed calls for mocked DB, Apis, and services
      for (const stubName in stubTraces) {
        const stubbedCalls = stubTraces[stubName];
        if (isArray(stubbedCalls)) {
          stubs[stubName].resetStub(stubbedCalls);
        } else {
          throw TypeError(`${stubName} stubbed calls must be array of arrays`)
        }
      }

      try {

        let actual;

        if (method === CALL_SELF) {
          actual = await system(...input);
        } else {
          actual = await system[method](...input);
        }

        if (expected !== EXPECTS_NO_OUT) {
          assert.deepEqual(actual, expected);
        }

        passedCases++;

      } catch (error) {

        if (error.constructor === expected) {
          logger.info(chalk.green('Threw expected %s error'), expected.name);
          passedCases++;
        } else {
          logger.error(chalk.red('Unexpected error for %s: %o'), method, error);
          failedCases++;
        }

      }

    }

    logger.shiftTab();

    results[method] = {
      totalCases,
      passedCases,
      failedCases,
    };

    logger.info(chalk.green('%s/%s cases passed'), passedCases, totalCases);

    results.passedCases += passedCases;
    results.failedCases += failedCases;
    results.totalCases += totalCases;

    if (passedCases === totalCases) {
      results.passedTests++;
      results.passedTestNames.push(method);
    } else {
      results.failedTests++;
      results.failedTestNames.push(method);
    }

    logTestResults(results, logger, `${method} Integration Test Summary`);

    allTestResults.push(results);

  }

  const talliedResults = tallyTestResults(allTestResults);

  logTestResults(talliedResults, logger, `${systemName} Integration Test Summary`);

  return talliedResults;

};

const _splitUnitTests = (linearTests = []) => {
  let testIndex;
  return linearTests.reduce((arr, funcOrTest) => {
    if (typeof funcOrTest === 'function') {
      testIndex = testIndex === undefined ? 0 : testIndex + 1;
      arr.push([funcOrTest]);
    } else if (isArray(funcOrTest)) {
      arr[testIndex].push(funcOrTest);
    }
    return arr;
  }, []);
};

/*
 * Basic functional tests of form:
 * runUnitTess[
 *   fn,
 *   [arg1, arg2, arg3, expected],
 *   [arg1, arg2, expected],
 *   [arg1, arg2, expected],
 *   fn2,
 *   ...
 * ]
 */
const runUnitTests = async (tests, logger, assert) => {

  const nextTests = _splitUnitTests(tests);

  let
  passedTests = 0,
  failedTests = 0,
  totalTests = nextTests.length;

  const results = {
    passedTests,
    failedTests,
    totalTests,
    passedCases: 0,
    failedCases: 0,
    totalCases: 0,
    passedTestNames: [],
    failedTestNames: [],
  };

  for (const [ fn, ...cases ] of nextTests) {

    let
    passedCases = 0,
    failedCases = 0,
    totalCases  = cases.length;

    const fnName = fn.name || 'λ';

    logger.info(chalk.magenta('Testing %s : %s cases'), fnName, totalCases);
    logger.tab();

    for (const testCase of cases) {

      const [...args] = testCase.slice(0, -1);
      const [expected] = testCase.slice(-1);

      logger.info('assert %s(%s) === %s', fnName, list(args.map(printR)), printR(expected));

      try {

        const actual = await fn(...args);

        assert.deepEqual(actual, expected);

        logger.info('%s result of %s', chalk.green('O.K.'), printR(actual));
        passedCases++;

      } catch (error) {
        if (error.constructor === expected) {
          logger.info('Got expected %s error ' + chalk.green('O.K.'), expected.name);
          passedCases++;
        } else {
          logger.error(chalk.red('Unexpected error for %s: %o'), fnName, error);
          failedCases++;
        }
      }

    }

    results[fnName] = {
      totalCases,
      passedCases,
      failedCases,
    };

    logger.info(chalk.green('%s/%s cases passed'), passedCases, totalCases);

    results.passedCases += passedCases;
    results.failedCases += failedCases;
    results.totalCases += totalCases;

    if (passedCases === totalCases) {
      results.passedTests++;
      results.passedTestNames.push(fnName);
    } else {
      results.failedTests++;
      results.failedTestNames.push(fnName);
    }

    logger.shiftTab();

  }

  return results;

}

const tallyTestResults = (results = [], initial = {}) => {

  return results.reduce((allResults, result) => {

    if (isNotObject(result)) {
      return allResults;
    }

    [
      'totalTests',
      'passedTests',
      'failedTests',
      'totalCases',
      'failedCases',
      'passedCases',
      'passedTestNames',
      'failedTestNames',
    ].forEach((key) => {
      if (isNumber(result[key])) {
        allResults[key] += result[key];
      } else if (isArray(result[key])) {
        allResults[key].push(...result[key])
      }
    });

    return allResults;

  }, {
    totalTests: 0,
    failedTests: 0,
    passedTests: 0,
    totalCases: 0,
    failedCases: 0,
    passedCases: 0,
    passedTestNames: [],
    failedTestNames: [],
    ...initial
  });

};

const logTestResults = (results = {}, logger, resultName) => {

  if (isNotObject(results)) {
    return;
  }

  const {
    totalTests = 0,
    passedTests = 0,
    failedTests = 0,
    passedCases = 0,
    failedCases = 0,
    totalCases = 0,
  } = results;

  logger.info(chalk.green(resultName));
  logger.tab();
  logger.info(chalk.green('Tests: %s/%s passed'), passedTests, totalTests);

  if (failedTests > 0) {
    logger.info(chalk.red('%s/%s failed'), failedTests, totalTests);
  }

  logger.info(chalk.green('Cases: %s/%s passed'), passedCases, totalCases);
  if (failedCases > 0) {
    logger.info(chalk.red('%s/%s failed'), failedCases, totalCases);
  }

  logger.shiftTab();

};

// running many test suites from ./test/index.js
const runTestSuites = async (testSuites, ctx) => {

  const {
    logger,
  } = ctx;

  logger.info(chalk.yellow(autoPad(' RUNNING A TEST SUITE ', '#', 80)));

  const allResults = [];

  for (const [suiteName, runTests] of testSuites) {

    logger.info(
      chalk.blue(
        autoPad(` TESTING ${suiteName.toUpperCase()} TEST SUITE `, '-', 80)
      ),
    );

    logger.tab();

    const results = await runTests(ctx);

    if (isObject(results)) {
      allResults.push(results);
    }

    logger.shiftTab();

    logger.info(chalk.green('%s unit test done!'), suiteName);

    logTestResults(results, logger, `${suiteName} Test Results`);

  };

  const talliedResults = tallyTestResults(allResults);

  logTestResults(talliedResults, logger, `Summary of Tests`);

  return talliedResults;

};

// prints out representation of a value for tests
const printR = (val) => {
  if (isArray(val)) {
    return chalk.green(fmt('%s', JSON.stringify(val)));
  } else if (isFunction(val)) {
    return chalk.gray('[function]');
  } else if (isObject(val)) {
    return chalk.green(fmt('%o', val));
  } else if ( typeof val === 'string') {
    return chalk.yellow(fmt('"%s"', val));
  }
  return chalk.gray(val);
};

const CALL_SELF = Symbol('CALL_SELF');
const SPREAD_IN = Symbol('SPREAD_IN');
const EXPECTS_FN_IN   = Symbol('EXPECTS_FN_IN');
const EXPECTS_NO_IN   = Symbol('EXPECTS_NO_IN');
const EXPECTS_NO_OUT  = Symbol('EXPECTS_NO_OUT');
const RETURN_COMPUTED = Symbol('RETURN_COMPUTED');
const RETURN_SELF     = Symbol('RETURN_SELF');
const RETURN_PROMISE = Symbol('RETURN_PROMISE');

const objectMocker = (mapConfig = null) => {

  const mapper = mapConfig === null
    ? () => ({})
    : objectMapper(mapConfig);

  return async ( override = {} ) => {

    const mapped = await mapper();

    return {
      ...mapped,
      ...override,
    };
  };

};

/**
 * Use:
 * deprecate(oldFunction, '2.5.0', '3.12.0');
 */
const deprecate = (fn = () => {}, name=fn.name, sinceVersion='now', depVersion='future releases') => {
  return (...args) => {
    console.warn(
      chalk.yellow([
        '%s has been marked deprecated since %s and',
        'will be removed in %s',
      ].join(' ')),
      name,
      sinceVersion,
      depVersion
    );
    return fn(...args);
  };
};

module.exports = {
  CALL_SELF,
  EXPECTS_FN_IN,
  EXPECTS_NO_IN,
  EXPECTS_NO_OUT ,
  RETURN_COMPUTED,
  RETURN_SELF,
  RETURN_PROMISE,
  SPREAD_IN,
  deprecate,
  TestStub,
  chainer,
  logTestResults,
  makeStub,
  mockCloudFlareApi,
  mockDb,
  mockIface,
  mockIoRedis,
  mockNamesiloApi,
  mockRascal,
  objectMocker,
  printR,
  runIntegrationTests,
  runTestSuites,
  runUnitTests,
  thener,
  tallyTestResults,
  tracer,
}
