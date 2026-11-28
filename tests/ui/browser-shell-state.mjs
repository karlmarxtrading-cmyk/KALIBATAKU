// Run against an isolated browser fixture with its active synthetic alias.
import {chooseLang,route,until} from '../integration/probes.mjs';

export async function run(w,r,base){
  const d=w.document;
  const field=name=>d.querySelector('main [name="'+name+'"]');
  const set=(name,value,kind='change')=>{
    const el=field(name);if(el.type==='checkbox')el.checked=value;else el.value=value;
    el.dispatchEvent(new w.Event(kind,{bubbles:true}));return el;
  };
  const check=(id,expected,actual,ok)=>r.checks.push({id,status:ok?'PASS':'FAIL',expected,actual});
  const setupReady=()=>d.querySelector('.setup button[type=submit]:not(:disabled)');
  await chooseLang(w,'id');
  await route(w,base,'packs?grade=7&level=2&op=ADD');
  const firstPage=[...d.querySelectorAll('a.pack-row')].map(n=>n.hash);
  d.querySelector('.pager button:last-child').click();
  const secondPage=[...d.querySelectorAll('a.pack-row')].map(n=>n.hash);
  check('AC-015-pages','Pages are bounded, disjoint; current range and page in URL',{
    firstPage,secondPage,range:d.querySelector('.result-range').textContent,url:w.location.hash
  },firstPage.length===8&&secondPage.length===8&&!firstPage.some(h=>secondPage.includes(h))&&w.location.hash.includes('page=2'));
  const pkg=new URLSearchParams(secondPage[0].split('?')[1]).get('pack');
  set('pack-search',pkg,'input');
  await until(()=>d.querySelectorAll('a.pack-row').length===1,'Search by package');
  await chooseLang(w,'en');
  await until(()=>field('pack-search')?.value===pkg&&d.querySelectorAll('a.pack-row').length===1,'Filtered catalogue after switching language');
  check('AC-015-locale','Package ID search and result persist after locale switch',{query:field('pack-search').value,href:d.querySelector('a.pack-row').hash,range:d.querySelector('.result-range').textContent},d.querySelector('a.pack-row').hash.includes(pkg));
  set('pack-search','not-an-existing-package','input');await until(()=>d.querySelector('.notice button'),'Clear unavailable package filter');
  d.querySelector('.notice button').click();
  check('AC-015-reset','Empty state can restore the original competency',{url:w.location.hash,rows:d.querySelectorAll('a.pack-row').length},!field('pack-search').value&&d.querySelectorAll('a.pack-row').length===8&&w.location.hash.includes('grade=7'));
  await route(w,base,'start?grade=1&level=1&op=ADD');
  await until(setupReady,'Setup ready');set('mode','speed');await until(setupReady,'Effective speed plan');
  set('question_count','2','input');set('duration','120');set('shuffle',true);
  field('shuffle').closest('details').open=true;set('planning_pace','90');
  await chooseLang(w,'id');
  await until(()=>setupReady()&&field('mode')?.value==='speed'&&field('shuffle')?.checked,'Restored speed controls');
  const restored={mode:field('mode').value,count:field('question_count').value,seconds:field('duration').value,shuffle:field('shuffle').checked,expanded:field('shuffle').closest('details').open,pace:field('planning_pace').value,action:setupReady().textContent,summary:d.querySelector('.plan-line').textContent};
  check('AC-047-setup','Mode, count, seconds, shuffle, pace, expanded options and effective summary preserved',restored,restored.count==='2'&&restored.seconds==='120'&&restored.expanded&&restored.pace==='90'&&restored.action.includes('2 soal')&&restored.summary.includes('120'));
  set('mode','assessment');await until(setupReady,'Full assessment');const countInAssessment=d.querySelector('.plan-line').textContent;await chooseLang(w,'en');await until(()=>setupReady()&&field('mode').value==='assessment','Translated assessment ready');
  set('mode','practice');await until(setupReady,'Restore practice count');
  check('AC-016-fixed','Fixed assessment count; prior editable count when switching back',{countInAssessment,practice:setupReady().textContent},countInAssessment.includes('10 soal')&&setupReady().textContent.includes('2 questions'));
  await route(w,base,'settings');set('theme','dark');set('textSize','large');set('reduceMotion',true);set('showTimer',false);
  w.location.reload();await until(()=>d!==w.document&&w.document.querySelector('main [name=theme]'),'Reload fresh document',15000);
  const fresh=w.document;const prefs={theme:fresh.documentElement.dataset.theme,text:fresh.documentElement.dataset.text,reduce:fresh.documentElement.dataset.reduceMotion,timer:fresh.querySelector('[name=showTimer]').checked,language:fresh.documentElement.lang,themes:[...fresh.querySelector('[name=theme]').options].map(o=>o.value)};
  check('AC-049-051-prefs','Theme, text, reduced motion, language and timer persist; system remains available',prefs,prefs.theme==='dark'&&prefs.text==='large'&&prefs.reduce==='true'&&!prefs.timer&&prefs.language==='en'&&prefs.themes.includes('system'));
  for(const [name,value] of [['theme','system'],['textSize','regular'],['reduceMotion',false],['showTimer',true]]){
    const el=fresh.querySelector('[name="'+name+'"]');if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));
  }
  const three=[];
  async function switchTo(alias){
    const page=await route(w,base,'profiles');
    const select=page.querySelector('main .data-body select');
    select.value=[...select.options].find(o=>o.textContent===alias).value;
    select.dispatchEvent(new w.Event('change',{bubbles:true}));
    page.querySelector('[data-switch-profile]').click();
    await until(()=>page.querySelector('.profile-control strong')?.textContent===alias,'Active switched alias');
  }
  async function addAlias(label){
    const page=await route(w,base,'profiles');
    const input=page.querySelector('[name=new-profile-name]');
    input.closest('details').open=true;
    const alias=label+'-'+w.crypto.randomUUID().slice(0,8);input.value=alias;input.dispatchEvent(new w.Event('input',{bubbles:true}));
    [...input.closest('details').querySelectorAll('button')].find(b=>/create|buat/i.test(b.textContent)).click();
    await until(()=>page.querySelector('.profile-control strong')?.textContent===alias,'New active alias');
    return alias;
  }
  const profileA=fresh.querySelector('.profile-control strong').textContent;
  await route(w,base,'');
  const originalResume=fresh.querySelector('.lesson-actions .primary')?.hash;
  for(const label of ['B','C']){
    const alias=await addAlias('State-'+label);
    const home=await route(w,base,'');
    const row={alias,header:home.querySelector('.profile-control strong')?.textContent,cta:home.querySelector('.lesson-actions .primary').hash};three.push(row);
    // 1.4: a profile's own choice is its start point (not a catalogue browse); it opens that stage's mission.
    const sp=await route(w,base,'start-point'),grade=label==='B'?7:8;
    const group=[...sp.querySelectorAll('details.start-grade')].find(x=>new RegExp('^(Kelas|Grade) '+grade+'$').test(x.querySelector('summary').textContent.trim()));group.open=true;
    [...group.querySelectorAll('button.start-stage')].find(b=>/Level 2$/.test(b.querySelector('strong').textContent)).click();
    await until(()=>w.location.hash.startsWith('#/session/')&&w.document.querySelector('.kp-answer'),'Start-point mission '+label,20000);
    row.session=w.location.hash;row.grade=w.document.querySelector('.kp-head .kp-sub')?.textContent;
  }
  await switchTo(three[0].alias);await route(w,base,'');
  const rememberedB=fresh.querySelector('.lesson-actions .primary').hash;
  await switchTo(profileA);await route(w,base,'');
  const restoredA=fresh.querySelector('.lesson-actions .primary').hash;
  check('AC-013-profiles','A retains its ongoing session; new B and C start at introductory material; B resumes its own start-point mission',{profileA,originalResume,restoredA,newProfiles:three,rememberedB},originalResume.startsWith('#/session/')&&restoredA===originalResume&&three.every(p=>p.alias===p.header&&p.cta.includes('node=arithmetic.addition.g01.l01'))&&rememberedB===three[0].session&&rememberedB!==three[1].session&&/(Kelas|Grade) 7/.test(three[0].grade||''));
  const menu=fresh.querySelector('.nav-more');menu.querySelector('summary').click();
  const destinations=[...menu.querySelectorAll('a')].map(a=>a.hash);
  menu.querySelector('a').focus();
  menu.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  check('AC-009-054-menu','Visible menu gives settings, offline, teacher simulation and admin; Escape restores summary focus',{destinations,open:menu.open,focus:fresh.activeElement.tagName},!menu.open&&fresh.activeElement===menu.querySelector('summary')&&['#/offline','#/settings','#/demo/teacher','#/demo/admin'].every(p=>destinations.includes(p)));

}
