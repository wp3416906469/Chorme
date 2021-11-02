/* eslint-disable no-undef */
const TYPE_MAP = {
  bookmark: '书签',
  history: '历史记录',
  domain: '域名',
  tab: '标签页',
  csdn: 'CSDN',
  doc: '文档',
};
function copy(value) {
  const transfer = document.createElement('input');
  document.body.appendChild(transfer);
  transfer.value = value; // 这里表示想要复制的内容
  transfer.focus();
  transfer.select();
  if (document.execCommand('copy')) {
    document.execCommand('copy');
  }
  transfer.blur();
  $('#tiptip_content').html('复制成功');
  document.body.removeChild(transfer);
}
class BackgroundCompleter {
  // The "name" is the background-page completer to connect to: "omni", "tabs", or "bookmarks".
  constructor(name) {
    // These are the actions we can perform when the user selects a result.
    this.name = name;
    this.completionActions = {
      navigateToUrl(url) {
        return openInNewTab => Vomnibar.getCompleter().launchUrl(url, openInNewTab);
      },
      switchToTab(tabId) {
        return () => chrome.runtime.sendMessage({ handler: 'selectSpecificTab', id: tabId });
      },
    };

    this.port = chrome.runtime.connect({ name: 'completions' });
    this.messageId = null;
    this.reset();

    this.port.onMessage.addListener(msg => {
      switch (msg.handler) {
        case 'keywords':
          this.keywords = msg.keywords;
          return this.lastUI.setKeywords(this.keywords);
        case 'completions':
          if (msg.id === this.messageId) {
            // The result objects coming from the background page will be of the form:
            //   { html: "", type: "", url: "", ... }
            // Type will be one of [tab, bookmark, history, domain, search], or a custom search engine description.
            for (const result of msg.results) {
              Object.assign(result, {
                performAction: result.type === 'tab' ? this.completionActions.switchToTab(result.tabId) : this.completionActions.navigateToUrl(result.url),
              });
            }

            // Handle the message, but only if it hasn't arrived too late.
            return this.mostRecentCallback(msg);
          }
          break;
      }
    });
  }

  filter(request) {
    const { query, callback } = request;
    this.mostRecentCallback = callback;
    let queryTerms = query
      .trim()
      .split(/\s+/)
      .filter(s => s.length > 0);
    if (queryTerms.length && queryTerms[0] === 'json') {
      queryTerms = ['json', queryTerms.slice(1, queryTerms.length).join('')];
    }
    this.port.postMessage(
      Object.assign(request, {
        handler: 'filter',
        name: this.name,
        id: (this.messageId = Utils.createUniqueId()),
        queryTerms: queryTerms,
        // We don't send these keys.
        callback: null,
      })
    );
  }

  reset() {
    this.keywords = [];
  }

  refresh(lastUI) {
    this.lastUI = lastUI;
    this.reset();
    return this.port.postMessage({ name: this.name, handler: 'refresh' });
  }

  FrameCompleterInsertDomComplete() {
    return this.port.postMessage({ name: this.name, handler: 'FrameCompleterInsertDomComplete' });
  }

  cancel() {
    // Inform the background completer that it may (should it choose to do so) abandon any pending query
    // (because the user is typing, and there will be another query along soon).
    this.port.postMessage({ name: this.name, handler: 'cancel' });
  }

  launchUrl(url, openInNewTab) {
    // If the URL is a bookmarklet (so, prefixed with "javascript:"), then we always open it in the current
    // tab.
    if (openInNewTab) {
      openInNewTab = !Utils.hasJavascriptPrefix(url);
    }
    chrome.runtime.sendMessage({
      handler: openInNewTab ? 'openUrlInNewTab' : 'openUrlInCurrentTab',
      url,
    });
  }
}

class VomnibarUI {
  constructor() {
    this.onKeyEvent = this.onKeyEvent.bind(this);
    this.onInput = this.onInput.bind(this);
    this.update = this.update.bind(this);
    this.refreshInterval = 0;
    this.onHiddenCallback = null;
    this.x = 0;
    this.y = 0;
    this.frameCompleters = [];
    this.initDom();
    this.initPopper();
    this.frameThrottle = this.throttle(this.frameCompletions, 2000);
  }

  setQuery(query) {
    this.input.value = query;
  }

  setKeyword(keyword) {
    this.customSearchMode = keyword;
  }

  setInitialSelectionValue(initialSelectionValue) {
    this.initialSelectionValue = initialSelectionValue;
  }

  setRefreshInterval(refreshInterval) {
    this.refreshInterval = refreshInterval;
  }

  setForceNewTab(forceNewTab) {
    this.forceNewTab = forceNewTab;
  }

  setCompleter(completer) {
    this.completer = completer;
    this.reset();
  }

  setKeywords(keywords) {
    this.keywords = keywords;
  }

  // The sequence of events when the vomnibar is hidden is as follows:
  // 1. Post a "hide" message to the host page.
  // 2. The host page hides the vomnibar.
  // 3. When that page receives the focus, and it posts back a "hidden" message.
  // 3. Only once the "hidden" message is received here is any required action  invoked (in onHidden).
  // This ensures that the vomnibar is actually hidden before any new tab is created, and avoids flicker after
  // opening a link in a new tab then returning to the original tab (see #1485).
  hide(onHiddenCallback = null) {
    this.onHiddenCallback = onHiddenCallback;
    this.input.blur();
    if (window.dateInterval) clearInterval(window.dateInterval);
    UIRender.postMessage('hide');
    this.reset();
  }

  onHidden() {
    if (typeof this.onHiddenCallback === 'function') {
      this.onHiddenCallback();
    }
    this.onHiddenCallback = null;
    return this.reset();
  }

  reset() {
    this.clearUpdateTimer();
    if (this.completionList && this.completionList.style) {
      this.completionList.style.display = '';
    }
    // this.input.value = "";
    this.completions = [];
    this.previousInputValue = null;
    this.customSearchMode = null;
    this.selection = this.initialSelectionValue;
    this.keywords = [];
    this.seenTabToOpenCompletionList = false;
    if (this.completer != null) {
      this.completer.reset();
    }
  }

  updateSelection() {
    // For custom search engines, we suppress the leading term (e.g. the "w" of "w query terms") within the vomnibar input.
    if (this.lastReponse.isCustomSearch && this.customSearchMode == null) {
      const queryTerms = this.input.value.trim().split(/\s+/);
      this.customSearchMode = queryTerms[0];
      this.input.value = queryTerms.slice(1).join(' ');
    }

    // For suggestions for custom search engines, we copy the suggested text into the input when the item is
    // selected, and revert when it is not.  This allows the user to select a suggestion and then continue typing
    // insertText处理
    if (this.selection >= 0 && this.completions[this.selection].insertText != null) {
      if (this.previousInputValue == null) {
        this.previousInputValue = this.input.value;
      }
      this.input.value = this.completions[this.selection].insertText;
    } else if (this.previousInputValue != null) {
      this.input.value = this.previousInputValue;
      this.previousInputValue = null;
    }

    // Highlight the selected entry, and only the selected entry.
    // 高亮某一项
    let selectionEl = '';
    for (let i = 0, end = this.completionList.children.length; i < end; i++) {
      const el = this.completionList.children[i];
      if (i === this.selection) {
        el.className.indexOf('vomnibarSelected') === -1 && (el.className += ' vomnibarSelected');
        selectionEl = this.completionList.children[i];
      } else {
        el.className = el.className.replace(' vomnibarSelected', '');
      }
    }
    if (selectionEl) {
      const elBottom = selectionEl.offsetTop - 61 + selectionEl.offsetHeight;
      const elTop = selectionEl.offsetTop - 61;

      const scrollTop = this.completionList.scrollTop;
      const scrollBottom = this.completionList.scrollTop + this.completionList.offsetHeight;

      // console.log('显示内容区间为', elTop, '~', elBottom);
      // console.log('滚动区间为', scrollTop, '~', scrollBottom);
      if (elTop >= scrollTop && elBottom <= scrollBottom) {
        //
      } else if (elBottom > scrollBottom) {
        this.completionList.scrollTop = elBottom - this.completionList.offsetHeight;
      } else if (elTop < scrollTop) {
        this.completionList.scrollTop = elTop;
      }
    }
  }

  // Returns the user's action ("up", "down", "tab", etc, or null) based on their keypress.  We support the
  // arrow keys and various other shortcuts, and this function hides the event-decoding complexity.
  actionFromKeyEvent(event) {
    const key = KeyboardUtils.getKeyChar(event);
    // Handle <Enter> on "keypress", and other events on "keydown"; this avoids interence with CJK translation
    // (see #2915 and #2934).
    if (event.type === 'keypress' && key !== 'enter') {
      return null;
    }
    if (event.type === 'keydown' && key === 'enter') {
      return null;
    }
    // ESC
    if (KeyboardUtils.isEscape(event)) {
      return 'dismiss';
    } else if (key === 'up' || (event.shiftKey && event.key === 'Tab') || (event.ctrlKey && (key === 'k' || key === 'p'))) {
      return 'up';
    } else if (event.key === 'Tab' && !event.shiftKey) {
      return 'tab';
    } else if (key === 'down' || (event.ctrlKey && (key === 'j' || key === 'n'))) {
      return 'down';
    } else if (event.ctrlKey && event.key === 'Enter') {
      return 'ctrl-enter';
    } else if (event.key === 'Enter') {
      return 'enter';
    } else if (event.key === 'Delete' && event.shiftKey && !event.ctrlKey && !event.altKey) {
      return 'remove';
    } else if (KeyboardUtils.isBackspace(event)) {
      return 'delete';
    }

    return null;
  }

  onCLickItem(event) {
    // 如果鼠标移动距离小于5则按单击处理
    if (Math.abs(event.pageX - (this.x || 0)) <= 5 && Math.abs(event.pageY - (this.y || 0) <= 5)) {
      const item = event.target.tagName.toLowerCase() === 'li' ? $(event.target) : $(event.target).parents('li');
      if (item.hasClass('utils')) return;
      item
        .addClass('vomnibarSelected')
        .siblings()
        .removeClass('vomnibarSelected');
      // 更新Selection
      this.selection = item.index();
      this.updateSelection();
      const openInNewTab = this.forceNewTab || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
      const completion = this.completions[this.selection];

      if (completion.type === 'doc') {
        this.input.value = 'doc ' + completion.title;
        this.onInput();
        event.stopPropagation();
        return;
      }
      // 如果有回调就处理
      if (completion.performAction) {
        this.hide(() => {
          // if (csdn && csdn.report) {
          //   const type = completion.type === 'utils' ? completion.extendType : completion.type;
          //   const keyword = completion.queryTerms
          //     .join(' ')
          //     .replace(/</g, '&lt;')
          //     .replace(/>/g, '&gt;');
          //   csdn.report.reportClick({ spm: '3001.4435', dest: completion.url, extra: JSON.stringify({ keyword: keyword, type: type }) });
          // }
          completion.performAction(openInNewTab);
        });
      }
      event.stopPropagation();
    } else {
      // 选择文本……
    }
  }

  onMouseDownItem(event) {
    this.x = event.pageX;
    this.y = event.pageY;
  }

  onKeyEvent(event) {
    let action, completion;
    this.lastAction = action = this.actionFromKeyEvent(event);
    if (!action) {
      return true;
    } // pass through

    const openInNewTab = this.forceNewTab || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
    // esc 隐藏
    if (action === 'dismiss') {
      this.hide();
    } else if (['tab', 'down'].includes(action)) {
      if (action === 'tab' && this.completer.name === 'omni' && !this.seenTabToOpenCompletionList && this.input.value.trim().length === 0) {
        this.seenTabToOpenCompletionList = true;
        this.update(true);
      } else if (this.completions.length > 0) {
        this.selection += 1;
        if (this.selection === this.completions.length) {
          this.selection = this.initialSelectionValue;
          this.completionList.scrollTop = 0;
        }
        this.updateSelection();
      }
    } else if (action === 'up') {
      this.selection -= 1;
      if (this.selection < this.initialSelectionValue) {
        this.selection = this.completions.length - 1;
        this.completionList.scrollTop = 0;
      }
      this.updateSelection();
    } else if (action === 'enter') {
      const c = this.completions[this.selection];
      const isCustomSearchPrimarySuggestion = c && c.isCustomSearchPrimarySuggestion && this.lastResponse.engine && this.lastResponse.engine.searchUrl;

      if (this.selection === -1 || isCustomSearchPrimarySuggestion) {
        let query = this.input.value.trim();
        // <Enter> on an empty query is a no-op.
        if (!(query.length > 0)) {
          return;
        }
        // First case (@selection == -1).
        // If the user types something and hits enter without selecting a completion from the list, then:
        //   - If a search URL has been provided, then use it.  This is custom search engine request.
        //   - Otherwise, send the query to the background page, which will open it as a URL or create a
        //     default search, as appropriate.
        //
        // Second case (isCustomSearchPrimarySuggestion).
        // Alternatively, the selected completion could be the primary selection for a custom search engine.
        // Because the the suggestions are updated asynchronously in omni mode, the user may have typed more
        // text than that which is included in the URL associated with the primary suggestion.  Therefore, to
        // avoid a race condition, we construct the query from the actual contents of the input (query).
        if (isCustomSearchPrimarySuggestion) {
          query = Utils.createSearchUrl(query, this.lastReponse.engine.searchUrl);
        }
        this.hide(() => Vomnibar.getCompleter().launchUrl(query, openInNewTab));
        // Vomnibar.getCompleter().launchUrl(query, openInNewTab)
      } else {
        completion = this.completions[this.selection];

        if (completion.type === 'doc') {
          this.input.value = 'doc ' + completion.title;
          this.onInput();
          event.stopPropagation();
          return;
        }

        this.hide(() => {
          // if (csdn && csdn.report) {
          //   const type = completion.type === 'utils' ? completion.extendType : completion.type;
          //   const keyword = completion.queryTerms
          //     .join(' ')
          //     .replace(/</g, '&lt;')
          //     .replace(/>/g, '&gt;');

          //   csdn.report.reportClick({ spm: '3001.4435', dest: completion.url, extra: JSON.stringify({ keyword, type }) });
          // }
          completion.performAction(openInNewTab);
        });
        // completion.performAction(openInNewTab)
      }
    } else if (action === 'ctrl-enter') {
      // Populate the vomnibar with the current selection's URL.
      if (!this.customSearchMode && this.selection >= 0) {
        if (this.previousInputValue == null) {
          this.previousInputValue = this.input.value;
        }
        this.input.value = this.completions[this.selection] != null ? this.completions[this.selection].url : undefined;
        this.input.scrollLeft = this.input.scrollWidth;
      }
    } else if (action === 'delete') {
      if (this.customSearchMode && this.input.selectionEnd === 0) {
        // Normally, with custom search engines, the keyword (e,g, the "w" of "w query terms") is suppressed.
        // If the cursor is at the start of the input, then reinstate the keyword (the "w").
        this.input.value = this.customSearchMode + this.input.value.trimStart();
        this.input.selectionStart = this.input.selectionEnd = this.customSearchMode.length;
        this.customSearchMode = null;
        this.update(true);
      } else if (this.seenTabToOpenCompletionList && this.input.value.trim().length === 0) {
        this.seenTabToOpenCompletionList = false;
        this.update(true);
      } else {
        return true; // Do not suppress event.
      }
    } else if (action === 'remove' && this.selection >= 0) {
      completion = this.completions[this.selection];
    }

    // It seems like we have to manually suppress the event here and still return true.
    event.stopImmediatePropagation();
    event.preventDefault();
    return true;
  }

  // Return the background-page query corresponding to the current input state.  In other words, reinstate any
  // search engine keyword which is currently being suppressed, and strip any prompted text.
  getInputValueAsQuery() {
    return (this.customSearchMode != null ? this.customSearchMode + ' ' : '') + this.input.value;
  }

  frameCompletions() {
    const completionItem = this.frameCompleters;
    if (Settings.debug) {
      console.log('frameCompletions', completionItem);
    }
    const framrWrap = document.getElementById(completionItem.info.id);
    if (!framrWrap) return;
    const shadowWrapper = DomUtils.createElement('div');
    const _shadowDOM = shadowWrapper.attachShadow ? shadowWrapper.attachShadow({ mode: 'open' }) : shadowWrapper;

    const _styleSheet = DomUtils.createElement('style');

    try {
      const clientHeight = document.body.clientHeight || window.innerHeight;
      const isProportion = completionItem.info.height.indexOf('%') > -1 || completionItem.info.height.indexOf('vh') > -1;
      // 如果是比例单位，转换为px
      if (isProportion) {
        completionItem.info.height = ((((completionItem.info.height.replace('%', '').replace('vh', '') / 100) * clientHeight - 70) / clientHeight) * 100).toFixed(2) + 'vh';
      }
    } catch (e) {}
    _styleSheet.innerHTML = `iframe { width: 100%; min-height: ${completionItem.info.height}; border:none; } iframe.hide{ display:none; }`;
    _shadowDOM.appendChild(_styleSheet);

    const iframeElement = DomUtils.createElement('iframe');
    iframeElement.className = 'hide';

    // 二维码拼接参数
    if (completionItem.info.extendType === 'qrcode') {
      if (!completionItem.info.params) {
        const queryObj = {};
        location.href.split('?')[1].replace(/([^?&=]+)=([^?&=]+)/g, function() {
          queryObj[arguments[1]] = decodeURIComponent(arguments[2]);
        });
        iframeElement.src = completionItem.info.url + '?query=' + encodeURIComponent(queryObj.referer);
      } else {
        iframeElement.src = completionItem.info.url + '?query=' + encodeURIComponent(completionItem.info.params);
      }
    } else {
      iframeElement.src = completionItem.info.url;
    }

    _shadowDOM.appendChild(iframeElement);
    framrWrap.appendChild(shadowWrapper);

    const $this = this;
    // 删除加载中...
    iframeElement.addEventListener('load', function() {
      $this.completer.FrameCompleterInsertDomComplete();
      if (framrWrap.childNodes.length && framrWrap.childNodes[0].className === 'frame-loading') {
        framrWrap.removeChild(framrWrap.childNodes[0]);
        iframeElement.className = '';
      }
    });
    // 延迟注入css、保证bg获取到iframe
    setTimeout(() => {
      this.completer.FrameCompleterInsertDomComplete();
      iframeElement.className = '';
    }, 800);
  }

  throttle(func, wait) {
    var lastTime = null;
    var timeout;
    return function() {
      var context = this;
      var now = new Date();
      if (now - lastTime - wait > 0) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        func.apply(context, arguments);
        lastTime = now;
      } else if (!timeout) {
        timeout = setTimeout(function() {
          func.apply(context, arguments);
        }, wait);
      }
    };
  }

  updateCompletions(callback = null) {
    return this.completer.filter({
      query: this.getInputValueAsQuery(),
      seenTabToOpenCompletionList: this.seenTabToOpenCompletionList,
      callback: lastReponse => {
        this.lastReponse = lastReponse;
        const { results } = this.lastReponse;
        this.completions = results;
        this.selection = (this.completions[0] != null ? this.completions[0].autoSelect : undefined) ? 0 : this.initialSelectionValue;
        // Update completion list with the new suggestions.
        // qrcode 'jjj'?<.br>
        this.completionList.innerHTML = this.completions
          .map(completion => {
            const keyword = completion.queryTerms
              .join(' ')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');

            // 1021.2146.3001.5698
            // old report => search result
            // const dataReportView = JSON.stringify({ spm: '3001.4435', dest: completion.url, extra: extra });
            let dataReportEl = '';
            // frame插件 ip wd 等自定义插件 || 预设工具曝光 date calc json qrcode
            if (completion.type === 'frame' || completion.type === 'utils') {
              const extra = {
                keyword,
                type: completion.type,
                // extendType: completion.type === 'utils' ? completion.extendType : completion.type,
                name: completion.title,
              };
              if (completion.type === 'utils') {
                extra.extendType = completion.extendType;
              }
              // frame插件添加pluginId
              if (completion.type === 'frame') {
                extra.pluginId = completion.info.pluginId;
                if (completion.isDoc) {
                  extra.type = 'utils';
                  extra.extendType = completion.extendType;
                }
              }

              const dataReportView = JSON.stringify({ spm: '3001.5698', dest: completion.url, extra: JSON.stringify(extra) });
              dataReportEl = `data-report-view='${dataReportView}'`;

              // 本地代码在搜索栏唤起不上报
              if (completion.type === 'frame' && completion.isWebPage) {
                dataReportEl = '';
              }
            }
            return `<li class="${completion.type}" ${dataReportEl}>${completion.html}</li>`;
          })
          .join('');

        if (window.dateInterval) clearInterval(window.dateInterval);

        // report data
        if (csdn && csdn.report) {
          csdn.report.viewCheck();
        }
        // type === 'date'
        if (this.completions.findIndex(v => v.type === 'utils' && v.extendType === 'date') > -1 && this.completions.length) {
          window.dateInterval = setInterval(() => {
            $('#vomnibar .utils .vimiumReset')
              .eq(2)
              .children('.vomnibarTitle')
              .children('.time-copy')
              .eq(0)
              .html(dayjs().format('YYYY-MM-DD HH:mm:ss'))
              .siblings('.time-copy')
              .html(+new Date());
          }, 1000);
        }
        // type === 'utils' 'json'
        const jsonFormatIndex = this.completions.findIndex(v => v.type === 'utils' && v.extendType === 'json');
        if (jsonFormatIndex > -1 && this.completions.length) {
          const { queryTerms } = this.completions[jsonFormatIndex];
          if (document.getElementById('json-format')) document.getElementById('json-format').innerHTML = '';
          setTimeout(() => {
            JSONFormat.init('json-format', queryTerms.slice(1).join('') || '{}');
          }, 100);
        }
        // type === 'frame'
        const frameCompletions = this.completions.find(v => v.type === 'frame');

        if (frameCompletions) {
          const framrWrap = document.getElementById(frameCompletions.info.id);
          const placeText = DomUtils.createElement('p');
          placeText.className = 'frame-loading';
          // placeText.innerHTML = frameCompletions.info.placeholder || '加载中...';
          // framrWrap.appendChild(placeText);
          var loadingWrap = DomUtils.createElement('div');
          loadingWrap.className = 'translate-loading';
          var loadingDiv = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          loadingDiv.setAttribute('class', 'circular');
          loadingDiv.setAttribute('viewBox', '25 25 50 50');
          var loadingPath = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          loadingPath.setAttribute('cx', '50');
          loadingPath.setAttribute('cy', '50');
          loadingPath.setAttribute('r', '20');
          loadingPath.setAttribute('fill', 'none');
          loadingPath.setAttribute('stroke-width', '5');
          loadingPath.setAttribute('stroke-miterlimit', '10');
          loadingPath.setAttribute('class', 'path');
          loadingDiv.appendChild(loadingPath);
          loadingWrap.appendChild(loadingDiv);
          placeText.appendChild(loadingWrap);
          framrWrap.appendChild(placeText);
          this.frameCompleters = frameCompletions;

          if (frameCompletions.queryTerms.length === 1) {
            this.frameCompletions();
          } else {
            this.frameThrottle();
          }
          // frameCompletions.info.loading ? this.frameThrottle() : this.frameCompletions();
        }
        // if (this.completions.length) {
        //   document.querySelector('.issues').style.display = 'block';
        // } else {
        //   document.querySelector('.issues').style.display = 'none';
        // }
        // 显示隐藏搜索栏
        this.completionList.style.display = this.completions.length > 0 ? 'block' : '';
        // 圆角
        if (!this.completions.length) {
          document.querySelector('.vomnibarSearchArea').style.borderRadius = '16px';
        } else {
          document.querySelector('.vomnibarSearchArea').style.borderRadius = '16px 16px 0 0';
        }
        this.selection = Math.min(this.completions.length - 1, Math.max(this.initialSelectionValue, this.selection));
        this.updateSelection();
        if (callback) {
          return callack();
        }

        try {
          $('.time-copy')
            .dblclick(function(e) {
              e.stopPropagation();
              e.preventDefault();
              window.getSelection ? window.getSelection().removeAllRanges() : document.selection.empty();
              copy(e.target.innerText);
              return false;
            })
            .tipTip({ maxWidth: 'auto', edgeOffset: 10, content: '双击复制' });
          $('.copy-btn')
            .click(function() {
              const value = $(this).attr('copy-data');
              copy(value);
            })
            .tipTip({ maxWidth: 'auto', edgeOffset: 10, content: '双击复制' });
          $('.settings-icon').tipTip({ maxWidth: 'auto', edgeOffset: 10, content: '设置' });
          const searchDomList = $('#vomnibar ul li');
          $(searchDomList).each((index, item) => {
            const className = $(item).attr('class');
            if (TYPE_MAP[className]) {
              $(item)
                .children('.vomnibarTopHalf')
                .children('.type-icon')
                .tipTip({ maxWidth: 'auto', edgeOffset: 10, content: TYPE_MAP[className] });
            }
          });
        } catch (e) {
          console.log(e);
        }
      },
    });
  }

  onInput() {
    let updateSynchronously;
    this.seenTabToOpenCompletionList = false;
    this.completer.cancel();
    if (this.input.value) {
      this.closeIcon.style.display = 'block';
    } else {
      this.closeIcon.style.display = 'none';
    }
    if (this.selection >= 0 && this.completions[this.selection].customSearchMode && !this.customSearchMode) {
      this.customSearchMode = this.completions[this.selection].customSearchMode;
      updateSynchronously = true;
    }
    // If the user types, then don't reset any previous text, and reset the selection.
    if (this.previousInputValue != null) {
      this.previousInputValue = null;
      this.selection = -1;
    }
    return this.update(updateSynchronously);
  }

  clearUpdateTimer() {
    if (this.updateTimer != null) {
      window.clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
  }

  shouldActivateCustomSearchMode() {
    const queryTerms = this.input.value.trimStart().split(/\s+/);
    return queryTerms.length > 1 && Array.from(this.keywords).includes(queryTerms[0]) && !this.customSearchMode;
  }

  update(updateSynchronously, callback = null) {
    // If the query text becomes a custom search (the user enters a search keyword), then we need to force a
    // synchronous update (so that the state is updated immediately).
    if (updateSynchronously == null) {
      updateSynchronously = false;
    }
    if (!updateSynchronously) {
      updateSynchronously = this.shouldActivateCustomSearchMode();
    }
    if (updateSynchronously) {
      this.clearUpdateTimer();
      this.updateCompletions(callback);
    } else if (this.updateTimer == null) {
      // Update asynchronously for a better user experience, and to take some load off the CPU (not every
      // keystroke will cause a dedicated update).
      this.updateTimer = Utils.setTimeout(this.refreshInterval, () => {
        this.updateTimer = null;
        return this.updateCompletions(callback);
      });
    }
    this.input.focus();
  }

  settingEvent() {
    const optionsUrl = chrome.runtime.getURL('pages/options.html');
    window.open(optionsUrl, '_blank');
  }

  initPopper() {
    // Popper.createPopper(button, tooltip, {
    //   placement: 'right',
    // });
  }

  updateCompletionListShow() {
    this.completionList.style.display = 'block';
  }

  initDom() {
    this.box = document.getElementById('vomnibar');
    this.input = this.box.querySelector('input');
    this.ul = this.box.querySelector('ul');
    this.settingIcon = this.box.querySelector('.settings-icon');
    this.closeIcon = this.box.querySelector('.close-icon');
    // 添加事件
    this.input.addEventListener('input', this.onInput);
    this.input.addEventListener('keydown', this.onKeyEvent);
    this.input.addEventListener('keypress', this.onKeyEvent);

    // 清除
    this.closeIcon.addEventListener('click', () => {
      document.querySelector('.vomnibarSearchArea').style.borderRadius = '16px';
      // document.querySelector('.issues').style.display = 'none';
      this.closeIcon.style.display = 'none';
      this.ul.innerHTML = '';
      this.input.value = '';
      this.input.focus();
    });

    this.settingIcon.addEventListener('click', this.settingEvent);
    $(this.ul).on('mouseup', 'li', this.onCLickItem.bind(this));
    $(this.ul).on('mousedown', 'li', this.onMouseDownItem.bind(this));

    // 列表
    this.completionList = this.box.querySelector('ul');
    // 默认隐藏
    this.completionList.style.display = '';
    // 窗口聚焦即input聚焦
    window.addEventListener('focus', () => this.input.focus());
    // A click in the vomnibar itself refocuses the input.
    this.box.addEventListener('click', event => {
      event.stopPropagation();
      return event.stopImmediatePropagation();
    });
    // 隐藏搜索框
    document.addEventListener('click', () => this.hide());
  }
}

const Vomnibar = {
  vomnibarUI: null, // the dialog instance for this window
  getUI() {
    return this.vomnibarUI;
  },
  completers: {},

  getCompleter(name) {
    if (!this.completers[name]) {
      this.completers[name] = new BackgroundCompleter(name);
    }
    return this.completers[name];
  },

  activate(userOptions) {
    const options = {
      completer: 'omni',
      query: '',
      newTab: false,
      selectFirst: false,
      keyword: null,
    };
    Object.assign(options, userOptions);
    Object.assign(options, { refreshInterval: options.completer === 'omni' ? 150 : 0 });

    const completer = this.getCompleter(options.completer);
    window.completer = completer;
    if (Settings.debug) {
      console.log(completer);
    }

    if (this.vomnibarUI != null) {
      csdn.report.reportPageView();
    }
    if (this.vomnibarUI && this.vomnibarUI.input.value === userOptions.query) {
      this.vomnibarUI.updateCompletionListShow();
      return;
    }

    if (this.vomnibarUI == null) {
      this.vomnibarUI = new VomnibarUI();
    }
    completer.refresh(this.vomnibarUI);
    this.vomnibarUI.setInitialSelectionValue(options.selectFirst ? 0 : -1);
    this.vomnibarUI.setCompleter(completer);
    this.vomnibarUI.setRefreshInterval(options.refreshInterval);
    this.vomnibarUI.setForceNewTab(options.newTab);
    if (options.query) {
      this.vomnibarUI.setQuery(options.query);
    }
    if (options.keyword) {
      this.vomnibarUI.setQuery('');
    }
    this.vomnibarUI.setKeyword(options.keyword);
    this.vomnibarUI.update(true);
  },
  // 隐藏搜索框
  hide() {
    if (this.vomnibarUI) {
      this.vomnibarUI.hide();
    }
  },
  // 隐藏搜索框结果
  onHidden() {
    if (this.vomnibarUI) {
      this.vomnibarUI.onHidden();
    }
  },
};

// Vomnibar.activate();
// // 事件响应 （挂在window上的message）
UIRender.registerHandler(function(event) {
  switch (event.data.name != null ? event.data.name : event.data) {
    case 'hide':
      Vomnibar.hide();
      break;
    case 'hidden':
      Vomnibar.onHidden();
      break;
    case 'activate':
      Vomnibar.activate(event.data);
      break;
  }
});
