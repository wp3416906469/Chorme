(window.webpackJsonp=window.webpackJsonp||[]).push([[17],{1170:function(t,e,r){t.exports=r.p+"images/newTab/assets/img/search-bookmark.png"},1172:function(t,e,r){t.exports=r.p+"images/newTab/assets/img/staus-enable.png"},1173:function(t,e,r){t.exports=r.p+"images/newTab/assets/img/staus-disable.png"},1184:function(t,e,r){},1213:function(t,e,r){"use strict";r(1184)},1246:function(t,e,r){"use strict";r.r(e);r(37),r(22),r(168),r(167),r(28),r(42),r(114),r(32);var o=r(53),n=r.n(o),a=r(1161),s=r(11),i=r(123),c=r(160),l=r(49),k=r(25);function u(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(t);e&&(o=o.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,o)}return r}function m(t,e,r){return e in t?Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):t[e]=r,t}var h={data:()=>({searchBookmark:"",bookmarks:[],currentIndex:0,bscroll:null}),computed:function(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?u(Object(r),!0).forEach((function(e){m(t,e,r[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):u(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}({},Object(l.c)("config",{tabIcons:"tab-icons",tabSettings:"tab-settings"})),watch:{searchBookmark(t){t?this.currentIndex=0:this.bookmarks.length&&"search"===this.bookmarks[0].id&&this.bookmarks.shift()}},methods:{search(){var t=this;this.searchBookmark&&(this.bookmarks.length&&"search"===this.bookmarks[0].id&&(this.bookmarks[0].children=[]),Object(i.h)(this.searchBookmark).then((function(e){t.bookmarks.length&&"search"===t.bookmarks[0].id?t.bookmarks[0].children=e:t.bookmarks.unshift({children:e,dateAdded:"",dateGroupModified:"",id:"search",index:"search",parentId:"",title:"搜索"})})))},bookmarkAdd(t){var e=this,r={id:+new Date+"-bookmark-".concat(t.id),logoType:"web",name:t.title,url:t.url,src:"chrome://favicon/size/32@2x/".concat(t.url),html:'<div class="fontLink" style="background: rgb(204, 204, 204);"><span><img src="chrome://favicon/size/32@2x/'.concat(t.url,'"></span></div>')};this.$store.commit("icons/setLockSlide",!1);var o=n()(this.tabIcons),a=!1,s=!1;if(o.find((function(t,e){var r=t.findIndex((function(t){return!t}));return r>-1&&(a=e,s=r,!0)})),"number"!=typeof a){var i=this.tabSettings,c=i.column,l=i.row;("[]"===JSON.stringify(o)||c*l<=o[o.length-1].length)&&o.push([]),a=o.length-1,s=o[o.length-1].length}o[a][s]=r,k.a.set("tab-icons",o),1===o.length&&1===o[0].length||this.$emit("on-add",a+1),setTimeout((function(){e.$store.commit("icons/setLockSlide",!0)}),700)},bookmarkEdit(t){var e=this.hasIcon(t);e&&this.$emit("on-edit",e)},bookmarkDelete(t){Object(c.b)(t,"url")},hasIcon(t){return Object(c.c)(t,this.tabIcons,"url")},bookmarkPreview(t){t.url.startsWith("chrome://")&&s.j?chrome.tabs.create({url:t.url}):window.open(t.url,"_blank")},initScroll(){var t=this;this.$nextTick((function(){t.bscroll?(t.bscroll.refresh(),t.bscroll.scrollTo(0,0)):t.bscroll=new a.a(".right-icons-bookmark",{scrollY:!0,click:!0,scrollbar:{fade:!0,interactive:!0},bounce:!1,mouseWheel:!0})}))},getBookmarksData(){var t=this;Object(i.a)().then((function(e){t.bookmarks=e,t.initScroll()}))}},created(){this.getBookmarksData()}},b=(r(1213),r(8)),d=Object(b.a)(h,(function(){var t=this,e=t.$createElement,o=t._self._c||e;return o("div",{attrs:{id:"bookmark-drawer"}},[o("div",{staticClass:"bookmark-search"},[o("img",{attrs:{src:r(1170),alt:""}}),t._v(" "),o("input",{directives:[{name:"model",rawName:"v-model.trim",value:t.searchBookmark,expression:"searchBookmark",modifiers:{trim:!0}}],attrs:{type:"text",placeholder:"搜索书签"},domProps:{value:t.searchBookmark},on:{input:[function(e){e.target.composing||(t.searchBookmark=e.target.value.trim())},t.search],blur:function(e){return t.$forceUpdate()}}}),t._v(" "),o("div",{directives:[{name:"show",rawName:"v-show",value:t.searchBookmark,expression:"searchBookmark"}],staticClass:"delete",on:{click:function(e){t.searchBookmark=""}}})]),t._v(" "),o("div",{staticClass:"scroll-wrap"},[o("div",{staticClass:"left-categrey"},[o("transition-group",{attrs:{tag:"ul",name:"flip-list"}},t._l(t.bookmarks,(function(e,r){return o("li",{key:e.id,class:{active:r===t.currentIndex},on:{click:function(e){t.currentIndex=r,t.initScroll()}}},[o("span",[t._v(t._s(e.title))])])})),0)],1),t._v(" "),o("div",{staticClass:"right-icons-bookmark"},[o("div",{staticClass:"content main-scroll"},[t.bookmarks.length?o("ul",t._l(t.bookmarks[t.currentIndex].children,(function(e){return o("a-popover",{key:e.id,attrs:{mouseEnterDelay:.3,overlayClassName:"bookmark-icon-popover",title:"",placement:"top",trigger:"hover"}},[o("template",{slot:"content"},[o("BlurGrass",{attrs:{firefox:""}}),t._v(" "),o("div",{staticClass:"popover-icon-item"},[o("p",[t._v(t._s(e.title))]),t._v(" "),o("div",{staticStyle:{"min-width":"100px","max-width":"200px"}},[o("span",{on:{click:function(r){return t.bookmarkPreview(e)}}},[t._v("访问")]),t._v(" "),t.hasIcon(e)?[e.url.startsWith("CSDN://")?t._e():o("span",{on:{click:function(r){return t.bookmarkEdit(e)}}},[t._v("编辑")]),t._v(" "),o("span",{on:{click:function(r){return t.bookmarkDelete(e)}}},[t._v("移除")])]:o("span",{on:{click:function(r){return t.bookmarkAdd(e)}}},[t._v("添加")])],2)])],1),t._v(" "),o("li",{on:{click:function(r){return t.bookmarkPreview(e)}}},[o("img",{attrs:{src:"chrome://favicon/size/32@2x/"+e.url,alt:""}}),t._v(" "),o("span",[t._v(t._s(e.title))]),t._v(" "),t.hasIcon(e)?o("img",{attrs:{src:r(1172),alt:""},on:{click:function(r){return r.stopPropagation(),t.bookmarkDelete(e)}}}):o("img",{attrs:{src:r(1173),alt:""},on:{click:function(r){return r.stopPropagation(),t.bookmarkAdd(e)}}})])],2)})),1):t._e()])])])])}),[],!1,null,null,null);e.default=d.exports}}]);