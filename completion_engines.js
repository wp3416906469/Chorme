/* eslint-disable */
// A completion engine provides search suggestions for a custom search engine.  A custom search engine is
// identified by a "searchUrl".  An "engineUrl" is used for fetching suggestions, whereas a "searchUrl" is used
// for the actual search itself.
//
// Each completion engine defines:
//
//   1. An "engineUrl". This is the URL to use for search completions and is passed as the option "engineUrl"
//      to the "BaseEngine" constructor.
//
//   2. One or more regular expressions which define the custom search engine URLs for which the completion
//      engine will be used. This is passed as the "regexps" option to the "BaseEngine" constructor.
//
//   3. A "parse" function. This takes a successful XMLHttpRequest object (the request has completed
//      successfully), and returns a list of suggestions (a list of strings).  This method is always executed
//      within the context of a try/catch block, so errors do not propagate.
//
//   4. Each completion engine *must* include an example custom search engine.  The example must include an
//      example "keyword" and an example "searchUrl", and may include an example "description" and an
//      "explanation".
//
// Each new completion engine must be added to the list "CompletionEngines" at the bottom of this file.
//
// The lookup logic which uses these completion engines is in "./completion_search.js".
//

// A base class for common regexp-based matching engines. "options" must define:
//   options.engineUrl: the URL to use for the completion engine. This must be a string.
//   options.regexps: one or regular expressions.  This may either a single string or a list of strings.
//   options.example: an example object containing at least "keyword" and "searchUrl", and optional "description".
class BaseEngine {
  constructor(options) {
    console.log(options);
    Object.assign(this, options);
    this.regexps = this.regexps.map(regexp => new RegExp(regexp));
  }

  match(searchUrl) {
    return Utils.matchesAnyRegexp(this.regexps, searchUrl);
  }
  getUrl(queryTerms) {
    return Utils.createSearchUrl(queryTerms, this.engineUrl);
  }
}

// Several Google completion engines package responses as XML. This parses such XML.
class GoogleXMLBaseEngine extends BaseEngine {
  parse(xhr) {
    return Array.from(xhr.responseXML.getElementsByTagName('suggestion'))
      .map(suggestion => suggestion.getAttribute('data'))
      .filter(suggestion => suggestion);
  }
}

class Google extends GoogleXMLBaseEngine {
  constructor() {
    super({
      engineUrl: 'https://suggestqueries.google.com/complete/search?ss_protocol=legace&client=toolbar&q=%s',
      regexps: ['^https?://[a-z]+\\.google\\.(com|ie|co\\.(uk|jp)|ca|com\\.au)/'],
      example: {
        searchUrl: 'https://www.google.com/search?q=%s',
        keyword: 'gg',
      },
    });
  }
}

class Wikipedia extends BaseEngine {
  constructor() {
    super({
      engineUrl: 'https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=%s',
      regexps: ['^https?://[a-z]+\\.wikipedia\\.org/'],
      example: {
        searchUrl: 'https://www.wikipedia.org/w/index.php?title=Special:Search&search=%s',
        keyword: 'wiki',
      },
    });
  }

  parse(xhr) {
    return JSON.parse(xhr.responseText)[1];
  }
}

class Bing extends BaseEngine {
  constructor() {
    super({
      engineUrl: 'https://api.bing.com/osjson.aspx?query=%s',
      regexps: ['^https?://cn\\.bing\\.com/search'],
      example: {
        searchUrl: 'https://cn.bing.com/search?q=%s',
        keyword: 'bing',
      },
    });
  }

  parse(xhr) {
    return JSON.parse(xhr.responseText)[1];
  }
}

class Baidu extends BaseEngine {
  constructor() {
    super({
      engineUrl: 'https://api.bing.com/osjson.aspx?query=%s',
      regexps: ['^https?://www\\.baidu\\.com/'],
      example: {
        searchUrl: 'https://www.baidu.com/s?wd=%s',
        keyword: 'bd',
      },
    });
  }
  parse(xhr) {
    return JSON.parse(xhr.responseText)[1];
  }
}

class Zhihu extends BaseEngine {
  constructor() {
    super({
      engineUrl: 'https://www.zhihu.com/api/v4/search/suggest?q=%s',
      regexps: ['^https?://www\\.zhihu\\.com/'],
      example: {
        searchUrl: 'https://www.zhihu.com/search?type=content&q=%s',
        keyword: 'zh',
      },
    });
  }
  parse(xhr) {
    try {
      return JSON.parse(xhr.responseText).suggest.map(v => v.query);
    } catch (e) {
      return [];
    }
  }
}

// A dummy search engine which is guaranteed to match any search URL, but never produces completions.  This
// allows the rest of the logic to be written knowing that there will always be a completion engine match.
class DummyCompletionEngine extends BaseEngine {
  constructor() {
    super({
      regexps: ['.'],
      dummy: true,
    });
  }
}

// Note: Order matters here.
const CompletionEngines = [Google, Wikipedia, Bing, Zhihu, Baidu, DummyCompletionEngine];

global.CompletionEngines = CompletionEngines;
