const fs = require('fs').promises;

const dirExists = async (path) => {

  try {

    const stat = await fs.stat()

    return stat.isDirectory();

  } catch (error) {

    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;

  }

};

const fileExists = async (path) => {

  try {

    const stat = await fs.stat()

    return stat.isFile();

  } catch (error) {

    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;

  }

};



module.exports = {
  dirExists,
  fileExists,
}
