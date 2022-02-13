const {
  collection: {
    arrayDiff,
    mergeDeep,
  },
  type: {
    isArray,
    isObject,
    isString,
  },
  string: {
    fmtPlaceholder,
  },
} = require('../lib/util');
/**
 * Following a pattern used elsewhere, menus are built
 * greedily and put in a non-ordered, flat, object. An
 * api is then provided to be used in templates to
 * produce whichever links you'd like in an order specified.
 *
 * Menus can be thought of as a collection of routes with
 * an optional heading, description where many collections
 * can have many routes and vice versa.
 */
module.exports = ( ctx = {} ) => {

  const {
    services: {
      hookService: {
        onRedux,
        redux,
      },
      routeService: {
        route,
      },
    },
  } = ctx;

  onRedux('menu', (menus = {}) => menus);

  const registerMenus = (nextMenus = {}) => {
    onRedux('menu', (menus) => {
      return mergeDeep(menus, nextMenus);
    });
  };

  /*
   * The breadcrumb is a special menu that is
   * the logical parents of the route id visited.
   *
   * TODO: implement somehow
   */
  const buildBreadCrumbMenu = (routeId, passedMenu = null) => {
    const menu = passedMenu === null
      ? redux('menu', {})
      : passedMenu;

    if (passedMenu !== null && !menu.items) {
      return false;
    }

    if (passedMenu === null) {
      for (const key in menu) {
        const hasId = buildBreadCrumbMenu(routeId, menu[key]);
      }
    }

    if (isArray(menu.items[routeId])) {
      return true;
    }

  }

  // core admin menu items
  registerMenus({
    admin: {
      items: {
        system: {
          title: 'System',
          help: 'Manage and view system components',
          items: {
            'manage:cache': ['Cache', ['can administrate system:cache']],
            'manage:route': ['Routes', ['can administrate system:route']],
            'manage:model': ['Model', ['can administrate system:model']],
          }
        },
      },
    },
    /**
     * Take these three (cache, route, model). each menu logically
     * is an administrative page under the adminMenu. Each of these
     * realistically is being used as a breadcrumb. What is the best
     * way (logically) to get the parents into a breadcrumb?
     * Does it make the most sense to treat each one as unique?
     */
    cache: {
      items: {
        adminPage: ['Admin', ['can get adminPage']],
      },
    },
    route: {
      items: {
        adminPage: ['Admin', ['can get adminPage']],
      },
    },
    model: {
      items: {
        adminPage: ['Admin', ['can get adminPage']],
      },
    },
    signedInTop: {
      items: {
        adminPage: ['Admin', ['can get adminPage']],
      }
    },
    footer: {
      items: {
        nav: {
          title: 'Nav',
          items: {
            home: ['Home'],
          },
        },
      },
    },
  });

  const buildItems = (menu, itemsInOrder, opts = {}) => {
    let {
      resource = null,
      resourceMap = null,
    } = opts;
    if (menu === null) {
      return [];
    }
    const result = {};
    if (menu.title) {
      result.title = menu.title;
      result.hasTitle = true;
    }
    if (menu.help) {
      result.help = menu.help;
      result.hasHelp= true;
    }
    let ordered = [];
    let sub = [];
    const getAllItems = opts[MENU_ITEMS_REST];
    if (getAllItems) {
      const menuKeys = Object.keys(menu.items || {});
      const restItems = arrayDiff(menuKeys, itemsInOrder);
      itemsInOrder.push(...restItems.sort());
    }
    // check itemsInOrder for constant symbols
    for (const item of itemsInOrder) {
      if (isString(item)) {
        if (!menu.items || !menu.items[item]) {
          continue;
        }
        const nextMenuOrLink = menu.items[item];
        // menus are objects and links are arrays
        if (isObject(nextMenuOrLink)) {
          const nextOrderedItems = Object.keys(nextMenuOrLink.items).sort();
          sub.push(buildItems(nextMenuOrLink, nextOrderedItems, opts));
        } else if (isArray(nextMenuOrLink)) {
          // A resource can be associated with a menu item a few different ways:
          // - passed as 3rd element in item array (after label and acl list)
          // - passed as a 'resource' option (should be for whole menu)
          // - picked from a 'resourceMap' option which uses route id
          // resources are used to parameterize the uri and to check against
          // ACL when permissions are scoped for ownership.
          let itemResource = resource;
          if (nextMenuOrLink.length >= 3) {
            itemResource = nextMenuOrLink[2];
          } else if (resourceMap) {
            itemResource = resourceMap[item];
          }
          // resourceful route has the URI parameterized and the resource
          // added as an element of the returned menu item array for ACL checks
          if (itemResource) {
            const routeUri = route(item, itemResource);
            const uri = routeUri === null
              ? fmtPlaceholder(item, itemResource)
              : routeUri;
            ordered.push([uri, ...nextMenuOrLink, itemResource]);
            continue;
          }
          const routeUri = route(item, itemResource);
          const uri = routeUri === null
            ? item
            : routeUri;
          ordered.push([uri, ...nextMenuOrLink]);
        }
      } else if (isArray(item)) {
        const [ nextKey, nextOrderedItems = [] ] = item;
        const nextMenu = menu.items[item];
        if (!nextOrderedItems.length) {
          nextOrderedItems.push(...Object.keys(nextMenu).sort());
        }
        sub.push(buildItems(nextMenu, nextOrderedItems, opts));
      }
    }
    if (ordered.length) {
      result.links = ordered;
      result.hasLinks = true;
    }
    if (sub.length) {
      result.sub = sub;
      result.hasSub = true;
    }
    return result;
  }

  /**
   * To get a menu, a full path can be used with dots
   * admin, admin.performance are all paths that resolve
   * to an item.
   */
  const getMenu = (path, orderedItems, opts = {}) => {
    const menus = redux('menu')
    const [fstKey, ...restKeys] = path.split('|');
    if (!fstKey || !menus[fstKey]) {
      return [];
    }
    const fstMenu = restKeys.reduce((nextMenu, key) => {
      if (!nextMenu) {
        return null;
      }
      if (isObject(nextMenu) && nextMenu.items && nextMenu.items[key]) {
        return nextMenu.items[key];
      }
      return nextMenu;
    }, menus[fstKey]);
    const fstMenuKeys = isObject(fstMenu.items)
      ? Object.keys(fstMenu.items).sort()
      : [];
    const getAllItems = opts[MENU_ITEMS_REST];
    if (!orderedItems) {
      orderedItems = fstMenuKeys.sort();
    } else if (getAllItems && orderedItems.length < fstMenukeys.length) {
      const restKeys = arrayDiff(fstMenuKeys, orderedItems);
      orderedItems.push(...restKeys.sort());
    }
    return buildItems(fstMenu, orderedItems, opts);
  }

  const
  MENU_ITEMS_REST = Symbol('MENU_ITEMS_REST'),
  MENU_DEPTH_FULL = Symbol('MENU_DEPTH_FULL');

  getMenu.MENU_ITEMS_REST = MENU_ITEMS_REST;
  getMenu.MENU_DEPTH_FULL = MENU_DEPTH_FULL;

  onRedux('webGlobalLocals', (locals) => ({
    ...locals,
    menu: getMenu,
  }));

  return {
    registerMenus,
    getMenu,
    MENU_ITEMS_REST,
    MENU_DEPTH_FULL,
  };

};
