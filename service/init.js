module.exports = ( ctx = {} ) => {

  process.env.UV_THREADPOOL_SIZE = require('os').cpus().length;

  process.on('unhandledRejection', (error) => {
    console.error('%o', error);
  });

};
