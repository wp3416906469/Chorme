/* eslint-disable */
const ExclusionRegexpCache = {
  cache: {},
  clear(cache) {
    this.cache = cache || {};
  },
  get(pattern) {
    if (pattern in this.cache) {
      return this.cache[pattern];
    } else {
      let result;
      // We use try/catch to ensure that a broken regexp doesn't wholly cripple Vimium.
      try {
        result = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      } catch (error) {
        BgUtils.log(`bad regexp in exclusion rule: ${pattern}`);
        result = /^$/; // Match the empty string.
      }
      this.cache[pattern] = result;
      return result;
    }
  },
};

// 管理排除规则设置 [ { pattern: "https?://mail.google.com/*", passKeys: "" }, ...]
// The Exclusions class manages the exclusion rule setting.  An exclusion is an object with two attributes:
// pattern and passKeys.  The exclusion rules are an array of such objects.
var Exclusions = {
  // Make RegexpCache, which is required on the page popup, accessible via the Exclusions object.
  RegexpCache: ExclusionRegexpCache,

  rules: Settings.get('exclusionRules'),

  // Merge the matching rules for URL, or null.  In the normal case, we use the configured @rules; hence, this
  // is the default.  However, when called from the page popup, we are testing what effect candidate new rules
  // would have on the current tab.  In this case, the candidate rules are provided by the caller.
  getKey() {
    const hotkey = Settings.get('searchModalHotKey') || 'o';
    if (!hotkey) return;
    const keyList = hotkey.split('+');
    let key = '';
    if (keyList) {
      if (keyList.length > 1) {
        key = `<`;
        keyList.forEach((i, index) => {
          if (index < keyList.length - 1) {
            key += `${hotkey_filter[i]}-`;
          } else {
            key += i;
          }
        });
        key += `>`;
      } else {
        key = keyList[0];
      }
      return key;
    }
    return hotkey;
  },
  getRule(url, rules) {
    try {
      if (rules == null) {
        rules = this.rules;
      }
      if (rules === 'undefined' || !rules) {
        rules = [];
      }
      const matchingRules = rules.filter(r => r.enable && r.pattern && url.search(ExclusionRegexpCache.get(r.pattern)) >= 0);

      for (let rule of matchingRules) {
        if (!rule.passKeys) {
          return 'oOBbTtCc<c-o>' + this.getKey();
        }
      }
      // const passKeys = matchingRules.map(r => r.passKeys.split(/\s+/)).join('');
      if (matchingRules.length > 0) {
        /*
         * 读取唤起快捷键配置
         * @passKeys 所有默认唤起搜索框快捷键（详情在./commands.js）
         * 如果匹配到了rules返回当前页面禁止使用的passKeys
         * 请注意：
         *   当前变量 matchingRules为二维数组，可能有多个规则触发当前页面，这里做的快捷键去重
         */
        return { passKeys: 'oOBbTtCc<c-o>' + this.getKey() };
        // return {
        // 	passKeys: Array.from(new Set(passKeys.split(',')))
        // 		.sort()
        // 		.join(''),
        // };
      } else {
        return null;
      }
    } catch (e) {
      console.warn('Exclusion Rules Error', Settings.get('exclusionRules'));
      return null;
    }
  },

  isEnabledForUrl(url) {
    const rule = Exclusions.getRule(url);
    return {
      isEnabledForUrl: !rule || (rule && rule.passKeys && rule.passKeys.length > 0),
      passKeys: rule ? rule.passKeys : '',
    };
  },

  setRules(rules) {
    // Callers map a rule to null to have it deleted, and rules without a pattern are useless.
    this.rules = rules.filter(rule => rule && rule.pattern);
    // Settings.set('exclusionRules', this.rules);
  },

  postUpdateHook(rules) {
    // NOTE(mrmr1993): In FF, the |rules| argument will be garbage collected when the exclusions popup is
    // closed. Do NOT store it/use it asynchronously.
    this.rules = Settings.get('exclusionRules');
    ExclusionRegexpCache.clear();
  },
};

// Register postUpdateHook for exclusionRules setting.
Settings.postUpdateHooks['exclusionRules'] = Exclusions.postUpdateHook.bind(Exclusions);

global.Exclusions = Exclusions;
