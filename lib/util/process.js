const { exec, spawn } = require('child_process');

const spawnPromise = (cmd, args=[], options={}) => {

  const p = spawn(cmd, args, options)

  const results = {
    success: '',
    error: ''
  };

  p.stdout.on('data', (data) => {

    results.success += data.toString();

  });

  p.stderr.on('data', (data) => {

    results.error += data.toString();

  });

  return new Promise((resolve, reject) => {

    p.on('exit', (code) => {

      console.log(`[${cmd}] exited with code ${code}`);

    });

  });

};

const execPromise = (command) => {

  return new Promise((resolve, reject) => {

    exec(command, (err, stdout, stderr) => {

      if (err) {
        return reject(err);
      }

      return resolve(stdout);

    });

  });

};

module.exports = {
  execPromise,
  spawnPromise
};
