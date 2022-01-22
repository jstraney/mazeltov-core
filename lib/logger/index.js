const chalk = require('chalk');

// bootstraping console to use morgan/winston
const fastJson = require('fast-json-stringify');

const stringify = fastJson({
  title: 'JSON Log Line Schema',
  type: 'object',
  properties: {
    time: {
      type: 'string',
    },
    label: {
      type: 'string',
    },
    level: {
      type: 'string',
    },
    message: {
      type: 'string',
    },
    durationMs: {
      type: 'integer',
    },
    uniqueRequestId: {
      type: 'string',
    },
    required: {
      time: true,
      label: true,
      level: true,
      message: true,
    },
  }
})

const {
  createLogger,
  format,
  transports
} = require('winston');

const DailyRotateFile = require('winston-daily-rotate-file');

const {
  combine,
  label,
  printf,
  splat,
} = format;

const lpad = (str, padding = ' ', num = 1) => {
  return padding.repeat(num).concat(str);
};

// memoized level labels so toUpperCase doesn't
// have to be called repeatedly
const levelLabels = {
  info: 'INFO',
  warn: 'WARN',
  profile: 'PROFILE',
  debug: 'DEBUG',
  error: 'ERROR',
};

const jsonLogFormat = printf(function (info) {

  let { level } = info;

  const message = typeof info.message === 'object'
    ? JSON.stringify(info.message)
    : info.message;

  const line = {
    time: new Date().toISOString(),
    label: info.label,
    level: levelLabels[level] || level,
    message,
  };

  if (info.durationMs) {
    line.durationMs = info.durationMs;
  }

  return stringify(line);

});

const _formatLevel = (level) => {
  switch (level) {
    case 'info':
      return chalk.blue('INFO');
    case 'warn':
      return chalk.yellow('WARN');
    case 'error':
      return chalk.red('ERROR');
    case 'debug':
      return chalk.cyan('DEBUG');
    default: level;
  }
}

// For running commands as a person
const humanLogFormat = printf(function (info) {

  let { level } = info;

  const message = typeof info.message === 'object'
    ? JSON.stringify(info.message)
    : info.message;

  const line = [
    _formatLevel(level),
    chalk.gray(info.label),
    message,
  ];

  if (info.durationMs) {
    line.push(`t=${info.durationMs}ms`)
  }

  return line.join('|');

});

const {
  LOG_LEVEL = 'info',
  LOG_TRANSPORTS = 'stdout',
  LOG_FORMAT='human',
  LOG_DIR = './log',
  LOG_TAB_CHAR = '..',
  LOG_MAX_TAB = 4,
} = process.env;

const tabFormat = format((info, opts) => {
  if (opts.indent > 0) {
    info.message = lpad(info.message, LOG_TAB_CHAR, opts.indent);
  }
  return info;
});

module.exports = (logLabel) => {

  const tabFormatOptions = {
    indent: 0,
  };

  const chosenTransports = LOG_TRANSPORTS.split(',').map((s) => s.trim());

  const logTransportsArr = [];

  const formatters = [
    label({label: logLabel}),
    splat(),
  ];

  if (LOG_FORMAT === 'human') {
    formatters.push(tabFormat(tabFormatOptions), humanLogFormat);
  } else {
    formatters.push(jsonLogFormat);
  }

  if (chosenTransports.includes('stdout')) {
    logTransportsArr.push(new transports.Console({
      format: combine(...formatters)
    }));
  }

  if (chosenTransports.includes('file')) {
    logTransportsArr.push(new DailyRotateFile({
      format: combine(...formatters),
      json: true,
      filename: '%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      dirname: LOG_DIR,
    }));
  }

  const level = LOG_LEVEL;

  const loggerInstance = createLogger({
    levels: {
      error: 0,
      warn: 1,
      info: 2,
      verbose: 4,
      debug: 5,
    },
    level,
    transports: logTransportsArr,
    exitOnError: false
  });

  loggerInstance.tab = () => {
    const { indent } = tabFormatOptions;
    const nextIndent = Math.min(indent + 1, LOG_MAX_TAB);
    tabFormatOptions.indent = nextIndent;
  };

  loggerInstance.shiftTab = () => {
    const { indent } = tabFormatOptions;
    const nextIndent = Math.max(0, indent - 1);
    tabFormatOptions.indent = nextIndent;
  };

  return loggerInstance;

};
