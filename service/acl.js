const {
  string: {
    pascalCase,
  },
  logic: {
    orArr,
  },
} = require('../lib/util');
/**
 * ACL service returns a new gate function
 * when you bind it to a subject (person requesting
 * a page); The subject is bound from middleware and
 * the returned function is passed to templates
 * to allow access to links and sections of a page.
 */
module.exports = ( ctx = {} ) => {

  const {
    loggerLib,
    services: {
      modelService,
      routeService: {
        getParamsFromUrl,
      }
    }
  } = ctx;

  const logger = loggerLib('@mazeltov/core/service/acl');

  /*
   * This binds the subject of a request to
   * produce an interface that checks fields on that subject.
   * models are used to resolve scoped permissions
   */
  const bindSubject = (subject = {}) => {

    const {
      id,
      permissions = {},
      isAdmin = false,
    } = subject;

    /**
     * Big ugh: again, pug does not support async operations
     * so for acl checks in templates, the scope cannot be checked
     * (requires checking against database usually)
     *
     * This may require a clever solution to allow using
     * subjectAuthorizer actions (can(Get|Create|List)
     */
    return (acl = []) => {
      if (isAdmin === true) {
        return true;
      }
      const granted = [];
      for (const name of acl) {
        if (permissions[name] === true) {
          return true;
        }
      }
      return false;
    };

  };

  const unscopedChecker = (acl = []) => {
    for (const permission of acl) {
      if (/ any | own /i.test(permission)) {
        // TODO: link to relevant docs on scoped vs unscoped perms.
        logger.warn([
          'You have passed what looks like a scoped permission',
          '"%s" into an unscopedCheck. This will not work as you',
          'may intend! Only unscoped permissions should be checked',
          'using this method.',
        ].join(' '));
      }
    }
    return (args = {}) => {
      const {
        _subjectPermissions = {},
        _subjectIsAdmin = false,
      } = args;
      if (_subjectIsAdmin) {
        return true;
      }
      for (const permission of acl) {
        if (_subjectPermissions[permission] === true) {
          return true;
        }
      }
      return false;
    }
  };

  return {
    bindSubject,
    unscopedChecker,
  };

};
