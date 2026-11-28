// Apply the stored palette before rendering or loading the application modules.
(()=>{
  let preferences={};
  try{preferences=JSON.parse(localStorage.getItem('kalibataku.preferences.v1'))||{};}catch{}
  const dark=preferences.theme==='dark'||(!['light','dark'].includes(preferences.theme)&&matchMedia('(prefers-color-scheme: dark)').matches);
  const root=document.documentElement;
  const route=location.hash.replace(/^#\/?/, '').split('?')[0];
  root.dataset.openSurface=route?(route.startsWith('session/')&&route!=='session/new'||route.startsWith('demo/')||route==='reports'?'focus':'page'):'home';
  root.dataset.theme=dark?'dark':'light';
  root.dataset.text=['large','xlarge'].includes(preferences.textSize)?preferences.textSize:'regular';
  root.dataset.reduceMotion=String(preferences.reduceMotion===true);
  root.lang=preferences.lang==='en'?'en':'id';
})();
