(window.webpackJsonp=window.webpackJsonp||[]).push([[19],{1182:function(t,e,r){},1211:function(t,e,r){"use strict";r(1182)},1245:function(t,e,r){"use strict";r.r(e);r(37),r(22),r(28),r(42),r(32);var n=r(553),i=r(49);function o(t){return function(t){if(Array.isArray(t))return a(t)}(t)||function(t){if("undefined"!=typeof Symbol&&Symbol.iterator in Object(t))return Array.from(t)}(t)||function(t,e){if(!t)return;if("string"==typeof t)return a(t,e);var r=Object.prototype.toString.call(t).slice(8,-1);"Object"===r&&t.constructor&&(r=t.constructor.name);if("Map"===r||"Set"===r)return Array.from(t);if("Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r))return a(t,e)}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function a(t,e){(null==e||e>t.length)&&(e=t.length);for(var r=0,n=new Array(e);r<e;r++)n[r]=t[r];return n}function s(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,n)}return r}function l(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?s(Object(r),!0).forEach((function(e){c(t,e,r[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):s(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}function c(t,e,r){return e in t?Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):t[e]=r,t}var u={name:"so-links",data:()=>({navs:[]}),created(){var t=this;n.a.getLinks().then((function(e){t.navs=t.dealWithData(e)})).catch((function(t){console.log("获取solinks失败",t)}))},computed:l(l({},Object(i.c)("config",{tabSettings:"tab-settings"})),{},{textModeSettings(){return this.tabSettings.textModeSettings||{}}}),methods:{dealWithData(t){if(t&&t.length)for(var e=0;e<t.length;e++){t[e].all=[];for(var r=t[e].list,n=0;n<r.length;n++){var i,a=r[n];if(a.arr)(i=t[e].all).push.apply(i,o(a.arr));else t[e].all.push(a)}}return t}}},f=(r(1211),r(8)),p=Object(f.a)(u,(function(){var t=this,e=t.$createElement,r=t._self._c||e;return r("div",{staticClass:"wrap-nav"},t._l(t.navs,(function(e){return r("dl",{key:e.id,staticClass:"block-nav"},[r("dt",{style:{color:t.textModeSettings.textColor}},[r("img",{attrs:{src:e.img,alt:""}}),r("span",[t._v(t._s(e.title))])]),t._v(" "),r("dd",[r("BlurGrass"),t._v(" "),r("ul",{staticClass:"clear"},t._l(e.all,(function(e,n){return r("li",{key:n},[r("a",{style:{color:t.textModeSettings.textColor},attrs:{href:e.url,target:t.tabSettings.isNewOpenAddress?"_blank":"_self",title:e.desc,"data-report-click":JSON.stringify({spm:t.SPM.soLinks,extend1:e.title,dest:e.url}),"data-report-view":JSON.stringify({spm:t.SPM.soLinks,extend1:e.title,dest:e.url})}},[t._v(t._s(e.title))])])})),0)],1)])})),0)}),[],!1,null,null,null);e.default=p.exports}}]);