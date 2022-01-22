// TODO: Bundle this with webpack/rollup so that lib/util can
// be leveraged.

// TODO: consider a smarter way (with hookService) to allow
// modules to register their own web based scripts that use closure

// Somehow introduce the @mazeltov/utils library to browser without
// too much bundling/packaging. bundling packaging will make it harder
// to use a hook ecosystem which would be ideal.

// Most of the core JS functionality revolves around
// bulk operations and search forms. Forms are not ajaxified by default.
window.owo = (($) => {

  // TODO: make some of this hook based to tie into contrib modules
  const hooks = {};

  const reducers = {};

  const onHook = (name, cb) => {
    hooks[name] = hooks[name] || [];
    hooks[name].push(cb);
  };

  const hook = (name, ...args) => {
    const cbs = hooks[name] || [];
    for (const cb of cbs) {
      cb(...args);
    }
  };

  const onRedux = (name, cb) => {
    reducers[name] = reducers[name] || [];
    reducers[name].push(cb);
  };

  const redux = (name, ...args) => {
    const [init, ...rest] = args;
    let result = init;
    const cbs = reducers[name] || [];
    for (let i = 0; i < cbs.length; i++) {
      const cb = cbs[i];
      result = cb(result, ...rest);
      if (result === undefined) {
        console.warn([
          'Reducer callback %s for %s returned undefined.',
          'be sure to return something from a reducer, even',
          'null where expected to prevent bugs.'
        ].join(' '), i, name);
      }
    }
    return result;
  };

  const buildSearchUrl = (url, query, currentPage, currentLimit) => {
    return `${url}?${query}&page=${currentPage}&limit=${currentLimit}`;
  };

  const createApiEndpoint = (baseUrl, method = 'get', defaultOptions = {}) => {

    const {
      query: defaultQuery = {},
    } = defaultOptions;

    return (options = {}) => {

      const query = {
        ...defaultQuery,
        ...(options.query || {})
      };

      const url = Object.keys(query).length
        ? `${baseUrl}?${$.param(query)}`
        : baseUrl;


      delete options.query;

      const params = options.params || {};

      const nextUrl = Object.keys(params).length
        ? url.replace(/:([a-zA-Z0-9-_]+)/, (orig, key) => params[key] || orig)
        : url;

      if (method !== 'get') {
        options.data = JSON.stringify({
          ...(defaultOptions.data || {}),
          ...(options.data || {})
        });
      }

      const nextOptions = {
        ...defaultOptions,
        ...options,
        url: nextUrl,
        contentType: 'application/json',
        dataType: 'json',
        method,
      };

      if (url !== '/api/token/refresh' && tokenExpired()) {
        refreshToken();
      }

      nextOptions.headers = {
        Authorization: `Bearer ${tokenInfo.access_token}`,
      };

      return $.ajax(nextOptions);
    };
  }

  const getApi = () => redux('webApi', {}, createApiEndpoint);

  const localStorageGetter = (key, json = true) => {
    return () => {
      return JSON.parse(window.localStorage.getItem(key));
    };
  };

  const localStorageSetter = (key) => {
    return (val) => {
      return window.localStorage.setItem(key, JSON.stringify(val));
    };
  };

  const getTokenInfo = localStorageGetter('token_info');
  const setTokenInfo = localStorageSetter('token_info');

  let tokenInfo = getTokenInfo();

  // Here is a circular dependency for the @mazeltov/access modules
  // client side API. Not positive the best way to resolve this,
  // right now there is a tight coupling here.
  const refreshToken = async () => {

    const api = await getApi();

    tokenInfo = await api.tokenGrant.refresh()
      .catch((error) => {
        console.error('could not refresh token');
        // TODO: redirect to login as AJAX will be broken without working token.
      });

    // set for later use
    setTokenInfo(tokenInfo);
  };

  const tokenExpired = () => {
    return !tokenInfo || !tokenInfo.expires ||Date.now() / 1000 >= tokenInfo.expires;
  }

  // ajaxify a search form by applying this to the form.
  const ajaxListForm = ( args = {} ) => {

    const {
      form,
      baseUrl,
      rowRenderer,
      keys,
    } = args;

    const $form = $(form);

    const pageUrl = new URL(window.location.origin + '/');

    const method = $form.attr('method');

    const currentParams = new URLSearchParams(window.location.search)
    let currentPage =  currentParams.get('page')   || 1;
    let currentLimit =  currentParams.get('limit') || 10;

    const sendRequest = createApiEndpoint(baseUrl, method);

    // bind submit event to form
    $form.submit(async (evt) => {

      evt.preventDefault();

      const query = $form.serialize();

      const url = buildSearchUrl(baseUrl, query, currentPage, currentLimit);

      const listResponse = await sendRequest({
        url,
      });

      rebuildPagination(listResponse);
      rebuildTable(listResponse.result);
      updateResultSummary(listResponse);

    });

    const pagination = $('.pagination', $form);

    pagination.on('click', 'a', function (evt) {
      evt.preventDefault();
      const $this = $(this);
      const url = new URL(window.location.origin + '/' + $this.attr('href'));
      const params = new URLSearchParams(url.search);
      currentPage = params.get('page') || 1;
      $form.submit();
      $('a', pagination).removeClass('active');
      $this.addClass('active');
    });

    const rebuildPagination = (listResult) => {

      const {
        firstPage,
        prevPage,
        nextPage,
        lastPage,
        localPages,
      } = listResult;

      const links = [];

      if (firstPage !== null) {
        const url = pageUrl + `?page=${firstPage}`;
        links.push($('<a>').text('First').attr('href', url));
      }
      if (prevPage !== null) {
        const url = pageUrl + `?page=${prevPage}`;
        links.push($('<a>').text('Back').attr('href', url));
      }
      if (localPages && localPages.length) {
        localPages.forEach((num) => {
          const url = pageUrl + `?page=${num}`;
          const link = $('<a>').text(num).attr('href', url);
          if (currentPage == num) {
            link.addClass('active');
          }
          links.push(link);
        });
      }
      if (nextPage !== null) {
        const url = pageUrl + `?page=${nextPage}`;
        links.push($('<a>').text('Next').attr('href', url));
      }
      if (lastPage !== null) {
        const url = pageUrl + `?page=${lastPage}`;
        links.push($('<a>').text('Last').attr('href', url));
      }
      pagination.html(links);
    };

    const updateResultSummary = (listResponse) => {
      const { result, total, currentPage, totalPages } = listResponse;
      $('.result-summary', $form).text([
        'Showing', result.length, 'of', total, 'Results', '-',
        'Page', currentPage, 'of', totalPages,
      ].join(' '));
    };

    const rebuildTable = (result) => {
      const $tbody = $('tbody', $form);
      $tbody.html(result.map((row, i) => rowRenderer(row, i, {
        currentPage,
      })));
    };

    $form.on('click', '.row-selector', function () {
      $(this).siblings('input').prop('checked', this.checked);
    });

  };

  // TODO: this is basically a re-implementation of objValueAggregateString
  // there needs to be a way to get @mazeltov/util passed into JS
  // still not sure what the best way is.
  const getRecordKey = (data, keys) => {
    return keys.reduce((str, key, index) => {
      if (index === 0) {
        return str.concat(data[key] || '');
      } else if (data[key] !== undefined) {
        return str.concat(':', data[key]);
      }
      return str;
    }, '');
  }

  // For simple selecting for bulk operations
  const formBulkSelector = ( args = {} ) => {

    const {
      $opsForm,
      keys = ['id'],
      storageKey,
      entityName,
      selectionSummary = null,
    } = args;

    const currentParams = new URLSearchParams(window.location.search)
    const submitSuccess =  currentParams.get('submitSuccess') === 'true';

    const dataToHtml = args.dataToHtml || ((data) => {
      return `<div>${getRecordKey(data, keys)}</div>`;
    });

    if (submitSuccess) {
      window.localStorage.removeItem(storageKey);
    }

    const pascalEntity = entityName
      .slice(0, 1)
      .toUpperCase()
      .concat(entityName.slice(1));

    const diffJSON = window.localStorage.getItem(storageKey) || '{"selected":[]}';
    let diff = JSON.parse(diffJSON);
    let selected = {};

    const findDatum = (key, arr) => {
      return arr.findIndex((datum) => {
        return getRecordKey(datum, keys) === key;
      });
    };

    const updateLookup = () => {
      selected = {};
      for (const data of diff.selected) {
        const key = getRecordKey(data, keys);
        selected[key] = true;
      }
    };

    updateLookup();

    const updateFormInputs = () => {
      const inputs = diff.selected.flatMap(dataToInputs(`${entityName}List`))
      $('div.inputs', $opsForm).html(inputs);
      const $selection = $('.selection', $opsForm);
      if (typeof selectionSummary === 'text') {
        $selection.html(selectionSummary);
      } else if (typeof selectionSummary === 'function') {
        $selection.html(selectionSummary(diff.selected));
      } else {
        $selection.html(diff.selected.map(dataToHtml));
      }
      if (diff.selected.length) {
        $opsForm.removeClass('hidden');
      } else {
        $opsForm.addClass('hidden');
      }
    }

    const dataToInputs = (listName) => {
      return (data, i) => {
        const id = getRecordKey(data, keys);
        return $('<div>').html(keys.map((key) => $('<input>').attr({
            id,
            type: 'hidden',
            name: `${listName}[${i}][${key}]`,
            value: data[key],
        })));
      };
    };

    function handleCheckboxState () {
      const $this = $(this);
      const dataJSON = $this.data('json');
      const data = typeof dataJSON === 'string' ? JSON.parse(dataJSON) : dataJSON;
      const wasChecked = data.wasChecked;
      const key = getRecordKey(data, keys);
      if (this.checked && !selected[key] && !wasChecked) {
        diff.selected.push(data);
      } else if (!this.checked) {
        const index = findDatum(key, diff.selected);
        if (index !== -1) {
          const fst = diff.selected.slice(0, index);
          const snd = diff.selected.slice(index + 1);
          diff.selected = fst.concat(snd);
        }
        delete selected[key];
      }
      updateLookup();
      updateFormInputs();
      window.localStorage.setItem(storageKey, JSON.stringify(diff));
    }


    const selectAll = $('.select-all');

    selectAll.click(function () {
      selectors.prop('checked', this.checked);
      selectors.each(handleCheckboxState);
    });

    const selectors = $('.row-selector');

    selectors.click(handleCheckboxState);

    selectors.each(function () {
      const $this = $(this);
      const dataJSON = $this.data('json');
      const data = typeof dataJSON === 'string' ? JSON.parse(dataJSON) : dataJSON;
      const key = getRecordKey(data, keys);
      if (findDatum(key, diff.selected) !== -1) {
        $this.prop('checked', true);
      }
    });

    const allSelected = selectors.get().reduce((theyIs, elm) => {
      return theyIs && elm.checked;
    }, true);

    selectAll.prop('checked', allSelected);

    $('a.button.clear', $opsForm).click(function (evt) {
      evt.preventDefault();
      diff = { selected : [] };
      selected = {};
      window.localStorage.setItem(storageKey, JSON.stringify(diff));
      updateFormInputs();
      $('.selection', $opsForm).html('');
      selectors.each(function () {
        const $this = $(this);
        const dataJSON = $this.data('json');
        const data = typeof dataJSON === 'string' ? JSON.parse(dataJSON) : dataJSON;
        if (data.wasChecked) {
          $this.prop('checked', true);
        } else {
          $this.prop('checked', false);
        }
      });
      selectAll.prop('checked', false);
    });

    updateFormInputs();
  }

  // For adding/removing selections accross pages. Just how
  // the role-permission page works
  const formDiffSelector = ( args = {} ) => {

    const {
      $opsForm,
      keys = ['id'],
      storageKey,
      entityName,
    } = args;

    const currentParams = new URLSearchParams(window.location.search)
    const submitSuccess =  currentParams.get('submitSuccess') === 'true';

    if (submitSuccess) {
      window.localStorage.removeItem(storageKey);
    }

    const pascalEntity = entityName
      .slice(0, 1)
      .toUpperCase()
      .concat(entityName.slice(1));

    const diffJSON = window.localStorage.getItem(storageKey) || '{"create":[],"remove":[]}';
    let diff = JSON.parse(diffJSON);
    let diffLookup = { create: {}, remove: {}};

    const findDatum = (key, arr) => {
      return arr.findIndex((datum) => {
        return getRecordKey(datum, keys) === key;
      });
    };

    const updateDiffLookup = () => {
      for (const data of diff.create) {
        const key = getRecordKey(data, keys);
        diffLookup.create[key] = true;
        delete diffLookup.remove[key]
      }
      for (const data of diff.remove) {
        const key = getRecordKey(data, keys);
        diffLookup.remove[key] = true;
        delete diffLookup.create[key]
      }
    };

    updateDiffLookup();

    const updateFormInputs = () => {
      const createInputs = diff.create.flatMap(dataToInputs(`create${pascalEntity}List`))
      const removeInputs = diff.remove.flatMap(dataToInputs(`remove${pascalEntity}List`))
      $('div.create-inputs', $opsForm).html(createInputs);
      $('div.remove-inputs', $opsForm).html(removeInputs);
      $('pre.diff.create').html(diff.create.map(dataToHtml));
      $('pre.diff.remove').html(diff.remove.map(dataToHtml));
      if (diff.create.length || diff.remove.length) {
        $opsForm.removeClass('hidden');
      } else {
        $opsForm.addClass('hidden');
      }
    }

    const dataToInputs = args.dataToInputs || ((listName) => {
      return (data, i) => {
        const id = getRecordKey(data, keys);
        return $('<div>').html(keys.map((key) => $('<input>').attr({
            id,
            type: 'hidden',
            name: `${listName}[${i}][${key}]`,
            value: data[key],
        })));
      };
    });

    const dataToHtml = args.dataToHtml || ((data) => {
      return `<div>${getRecordKey(data, keys)}</div>`;
    });

    function handleCheckboxState () {
      const $this = $(this);
      const dataJSON = $this.data('json');
      const data = typeof dataJSON === 'string' ? JSON.parse(dataJSON) : dataJSON;
      const wasChecked = data.wasChecked;
      const key = getRecordKey(data, keys);
      if (this.checked && !diffLookup.create[key] && !wasChecked) {
        diff.create.push(data);
      } else if (!this.checked && wasChecked && !diffLookup.remove[key]) {
        diff.remove.push(data)
      }
      if (this.checked) {
        const i = findDatum(key, diff.remove);
        if (i !== -1) {
          const fst = diff.remove.slice(0, i);
          const snd = diff.remove.slice(i + 1);
          diff.remove = fst.concat(snd)
        }
        delete diffLookup.remove[key];
      } else {
        const i = findDatum(key, diff.create);
        if (i !== -1) {
          const fst = diff.create.slice(0, i);
          const snd = diff.create.slice(i + 1);
          diff.create = fst.concat(snd)
        }
        delete diffLookup.create[key];
      }
      updateDiffLookup();
      updateFormInputs();
      window.localStorage.setItem(storageKey, JSON.stringify(diff));
    }

    const selectAll = $('.select-all');

    selectAll.click(function () {
      selectors.prop('checked', this.checked);
      selectors.each(handleCheckboxState);
    });

    const selectors = $('.row-selector');

    selectors.click(handleCheckboxState);

    selectors.each(function () {
      const $this = $(this);
      const dataJSON = $this.data('json');
      const data = typeof dataJSON === 'string' ? JSON.parse(dataJSON) : dataJSON;
      const key = getRecordKey(data, keys);
      if (findDatum(key, diff.create) !== -1) {
        $this.prop('checked', true);
      }
      if (findDatum(key, diff.remove) !== -1) {
        $this.prop('checked', false);
      }
    });

    const allSelected = selectors.get().reduce((theyIs, elm) => {
      return theyIs && elm.checked;
    }, true);

    selectAll.prop('checked', allSelected);

    $('a.button.clear', $opsForm).click(function (evt) {
      evt.preventDefault();
      diff = { create: [], remove: []};
      diffLookup = { create: {}, remove: {}};
      window.localStorage.setItem(storageKey, JSON.stringify(diff));
      updateFormInputs();
      selectors.each(function () {
        const $this = $(this);
        const dataJSON = $this.data('json');
        const data = typeof dataJSON === 'string' ? JSON.parse(dataJSON) : dataJSON;
        if (data.wasChecked) {
          $this.prop('checked', true);
        } else {
          $this.prop('checked', false);
        }
      });
      selectAll.prop('checked', false);
    });

    updateFormInputs();

  };

  return {
    getApi,
    ajaxListForm,
    formBulkSelector,
    formDiffSelector,
    hook,
    redux,
    onHook,
    onRedux,
  };

})(jQuery);
