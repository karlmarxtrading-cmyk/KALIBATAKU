import {until,delay,chooseTheme,chooseLang,route,resize,button,geometry} from './probes.mjs';
const $=s=>document.querySelector(s), base=new URL('/school/math/',document.baseURI).href;
let previous=null;
$('#open').onclick=async()=>{
  if(previous&&!previous.closed)previous.close();
  const [width,height]=$('#size').value.split('x').map(Number);
  const w=previous=window.open('about:blank','_blank','popup,width='+width+',height='+height);
  $('#out').textContent='Preparing…';
  try{
    await route(w,base,'');await resize(w,width,height);await chooseLang(w,$('#lang').value);await chooseTheme(w,base,$('#theme').value);
    const path=$('#path').value;
    if(path.startsWith('player-')){
      const target={'player-id':[1,1,'ADD'],'player-signed':[7,2,'SUB'],'player-decimal':[6,2,'DIV'],'player-fraction':[12,2,'MIX']}[path];
      await route(w,base,'session/new?grade='+target[0]+'&level='+target[1]+'&op='+target[2]+'&mode=practice');
      (await until(()=>w.document.querySelector('form.setup button[type=submit]:not(:disabled)'),'Effective session plan')).click();await until(()=>w.document.querySelector('.kp-answer'),'Real player');
    }else await route(w,base,path);
    $('#out').textContent=JSON.stringify(geometry(w),null,2);
  }catch(e){$('#out').textContent=e.message;}
};
