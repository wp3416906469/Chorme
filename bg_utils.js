/* eslint-disable */
const TIME_DELTA = 500; // Milliseconds.

// TabRecency associates a logical timestamp with each tab id.  These are used to provide an initial
// recency-based ordering in the tabs vomnibar (which allows jumping quickly between recently-visited tabs).
class TabRecency {
  constructor() {
    this.timestamp = 1;
    this.current = -1;
    this.cache = {};
    this.lastVisited = null;
    this.lastVisitedTime = null;

    chrome.tabs.onActivated.addListener(activeInfo => this.register(activeInfo.tabId));
    chrome.tabs.onRemoved.addListener(tabId => this.deregister(tabId));

    chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
      this.deregister(removedTabId);
      this.register(addedTabId);
    });

    if (chrome.windows != null) {
      chrome.windows.onFocusChanged.addListener(wnd => {
        if (wnd !== chrome.windows.WINDOW_ID_NONE) {
          chrome.tabs.query({ windowId: wnd, active: true }, tabs => {
            if (tabs && tabs[0]) {
              this.register(tabs[0].id);
            }
            return chrome.runtime.lastError;
          });
        }
      });
    }
  }

  register(tabId) {
    const currentTime = new Date();
    // Register tabId if it has been visited for at least @timeDelta ms.  Tabs which are visited only for a
    // very-short time (e.g. those passed through with `5J`) aren't registered as visited at all.
    if (this.lastVisitedTime != null && TIME_DELTA <= currentTime - this.lastVisitedTime) {
      this.cache[this.lastVisited] = ++this.timestamp;
    }

    this.current = this.lastVisited = tabId;
    this.lastVisitedTime = currentTime;
  }

  deregister(tabId) {
    if (tabId === this.lastVisited) {
      // Ensure we don't register this tab, since it's going away.
      this.lastVisited = this.lastVisitedTime = null;
    }
    delete this.cache[tabId];
  }

  // Recently-visited tabs get a higher score (except the current tab, which gets a low score).
  recencyScore(tabId) {
    if (!this.cache[tabId]) {
      this.cache[tabId] = 1;
    }
    if (tabId === this.current) {
      return 0.0;
    } else {
      return this.cache[tabId] / this.timestamp;
    }
  }

  // Returns a list of tab Ids sorted by recency, most recent tab first.
  getTabsByRecency() {
    const tabIds = Object.keys(this.cache || {});
    tabIds.sort((a, b) => this.cache[b] - this.cache[a]);
    return tabIds.map(tId => parseInt(tId));
  }
}

var BgUtils = {
  tabRecency: new TabRecency(),

  // Log messages to the extension's logging page, but only if that page is open.
  log: (function() {
    const loggingPageUrl = chrome.runtime.getURL('pages/logging.html');
    if (loggingPageUrl != null) {
      // console.log(`Vimium logging URL:\n  ${loggingPageUrl}`);
    } // Do not output URL for tests.
    // For development, it's sometimes useful to automatically launch the logging page on reload.
    if (localStorage.autoLaunchLoggingPage) {
      chrome.windows.create({ url: loggingPageUrl, focused: false });
    }
    return function(message, sender = null) {
      for (let viewWindow of chrome.extension.getViews({ type: 'tab' })) {
        if (viewWindow.location.pathname === '/pages/logging.html') {
          // Don't log messages from the logging page itself.  We do this check late because most of the time
          // it's not needed.
          if ((sender != null ? sender.url : undefined) !== loggingPageUrl) {
            const date = new Date();
            let [hours, minutes, seconds, milliseconds] = [date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()];
            if (minutes < 10) {
              minutes = '0' + minutes;
            }
            if (seconds < 10) {
              seconds = '0' + seconds;
            }
            if (milliseconds < 10) {
              milliseconds = '00' + milliseconds;
            }
            if (milliseconds < 100) {
              milliseconds = '0' + milliseconds;
            }
            const dateString = `${hours}:${minutes}:${seconds}.${milliseconds}`;
            const logElement = viewWindow.document.getElementById('log-text');
            logElement.value += `${dateString}: ${message}\n`;
            logElement.scrollTop = 2000000000;
          }
        }
      }
    };
  })(),

  getHostname(url) {
    if (!url) {
      return '';
    }
    const a = document.createElement('a');
    a.href = url;
    return a.hostname;
  },

  // Remove comments and leading/trailing whitespace from a list of lines, and merge lines where the last
  // character on the preceding line is "\".
  parseLines(text) {
    return text
      .replace(/\\\n/g, '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !Array.from('#"').includes(line[0]));
  },

  // ["json:json,js", "calc: calc", "date: date, time", "qrcode: qrcode", "doc: doc"]
  // => "{"json":"json","js":"json","calc":"calc","date":"date","time":"date","qrcode":"qrcode","doc":"doc"}"
  parseKeyValue(arr) {
    if (Object.prototype.toString.call(arr).slice(8, -1) !== 'Array') {
      return [];
    }
    return arr.reduce((pre, cur) => {
      const curValueMap = cur.replace(/\s+/g, '').split(':');
      const key = curValueMap[0];
      const value = curValueMap[1].split(',');
      let result = value.reduce((p, c) => {
        return p ? { ...p, [c]: key } : { [c]: key };
      }, '');
      return pre ? { ...pre, ...result } : result;
    }, '');
  },

  usePresupposition(queryTerms, presupStr) {
    if (!queryTerms || !queryTerms.length) {
      return false;
    }
    const presupposition = this.parseLines(Settings.get('presupposition'));
    const queryType = this.parseKeyValue(presupposition);
    const queryFirst = queryTerms[0];
    return queryType[queryFirst] === presupStr;
  },

  getPresuppositionName() {
    return {
      json: 'JSON格式化',
      calc: '计算器',
      date: '日期转换',
      qrcode: '二维码生成',
      doc: '文档查询',
      bm: '搜索书签',
      his: '搜索历史记录',
      version: '查看版本',
    };
  },

  getpresuppositionKey() {
    const presuppositionText = this.parseLines(Settings.get('presupposition'));
    const presuppositionKey = Object.keys(this.parseKeyValue(presuppositionText));
    return presuppositionKey;
  },

  // 获取自定义功能的所有key, 包括customEngine、内置工具的触发词、自定义的iframe、version、help
  getExcludeKeys(field) {
    // customEngine Keys
    const enginessDisableKey = this.parseLines(Settings.get('searchEngines'))
      .map(v => {
        let tokens = v.split(/\s+/);
        return tokens.length >= 2 ? tokens[0].split(':')[0] : '';
      })
      .filter(v => v);
    // presupposition
    const presuppositionKey = this.getpresuppositionKey();
    // iframe keys
    const iframeKeys = Object.keys(Settings.get('iframeMap'));
    const webPagesMapKeys = (Settings.get('webPagesMap') || []).filter(i => i.enable).map(i => i.triggerWord);
    const typeMap = {
      engine: enginessDisableKey,
      iframe: iframeKeys,
      presupposition: presuppositionKey,
      webPagesMapKeys: webPagesMapKeys,
    };

    if (field) {
      return typeMap.hasOwnProperty(field) ? typeMap[field] : [];
    } else {
      try {
        return [...presuppositionKey, ...enginessDisableKey, ...iframeKeys, ...webPagesMapKeys, 'version'];
      } catch (e) {
        return presuppositionKey
          .concat(enginessDisableKey)
          .concat(iframeKeys)
          .concat(webPagesMapKeys)
          .concat(['version']);
      }
    }
  },

  escapedEntities: {
    '"': '&quots;',
    '&': '&amp;',
    "'": '&apos;',
    '<': '&lt;',
    '>': '&gt;',
  },

  escapeAttribute(string) {
    return string.replace(/["&'<>]/g, char => BgUtils.escapedEntities[char]);
  },
};

// Utility for parsing and using the custom search-engine configuration.  We re-use the previous parse if the
// search-engine configuration is unchanged.
const SearchEngines = {
  previousSearchEngines: null,
  searchEngines: null,

  refresh(searchEngines) {
    if (this.previousSearchEngines == null || searchEngines !== this.previousSearchEngines) {
      this.previousSearchEngines = searchEngines;
      this.searchEngines = new AsyncDataFetcher(function(callback) {
        const engines = {};
        for (let line of BgUtils.parseLines(searchEngines)) {
          const tokens = line.split(/\s+/);
          if (tokens.length >= 2) {
            const keyword = tokens[0].split(':')[0];
            const searchUrl = tokens[1];
            const description = tokens[2] || `search (${keyword})`;
            if (Utils.hasFullUrlPrefix(searchUrl) || Utils.hasJavascriptPrefix(searchUrl)) {
              engines[keyword] = { keyword, searchUrl, description };
            }
          }
        }

        callback(engines);
      });
    }
  },

  // Use the parsed search-engine configuration, possibly asynchronously.
  use(callback) {
    this.searchEngines.use(callback);
  },

  // Both set (refresh) the search-engine configuration and use it at the same time.
  refreshAndUse(searchEngines, callback) {
    this.refresh(searchEngines);
    this.use(callback);
  },
};

BgUtils.TIME_DELTA = TIME_DELTA; // Referenced by our tests.

global.SearchEngines = SearchEngines;
global.BgUtils = BgUtils;
