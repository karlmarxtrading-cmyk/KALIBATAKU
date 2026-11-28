// Only private /probe-temporary-*/ QA fixtures load this before the application.
if(new URLSearchParams(location.search).get('fixture')==='appearance'){
  const native=window.matchMedia.bind(window),scheme=new EventTarget();
  scheme.media='(prefers-color-scheme: dark)';scheme.matches=false;
  window.matchMedia=query=>query===scheme.media?scheme:native(query);
  window.qaPreferredDark=matches=>{scheme.matches=matches;const e=new Event('change');Object.defineProperty(e,'matches',{value:matches});scheme.dispatchEvent(e);};
  window.qaBeforeApp=[];new MutationObserver(()=>{if(!document.querySelector('header .profile-pill')&&document.documentElement.dataset.theme)window.qaBeforeApp.push(document.documentElement.dataset.theme);}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
}else Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
