// middleware for storing form values in session to be used in
// a multistep form. Form values must be unique in each step
module.exports = (config = {}) => {

  // optionally pass a key for the form values to be stored under
  const {
    formName = 'multistep',
  } = config;

  const key = `${formName}Data`;

  return (req, res, next) => {

    const formData = req.session[key];

    if (req.method === 'get') {
      req.session[key] = {...formData, ...req.query};
    } else {
      req.session[key] = {...formData, ...req.body};
    }

    res.locals[key] = formData;

    next();

  };

};
