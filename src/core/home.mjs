import {element as e,icon,link,routeTo} from './dom.mjs';
import {bands,selection,tr} from './bank.mjs';
import {questionCount} from './material.mjs';
import {queryAttemptSummaries,getStatus} from '../data/store.js';

export const bandCard=(ctx,band)=>link('curriculum?band='+band.id,[e('span',{class:'band-mark '+band.css,'aria-hidden':'true'},e('i')),e('span',{},e('strong',{},ctx.t(band.label)),e('small',{},ctx.t('grades')+' '+band.from+'–'+band.to)),e('span',{class:'next'},icon('next',19))],'band-card');
export async function home(ctx){
  const {root,t,L,scope}=ctx;
  const [recent,open,storage]=await Promise.all([
    queryAttemptSummaries(scope,{limit:1}),queryAttemptSummaries(scope,{status:'ongoing',limit:1}),getStatus()
  ]);
  const latest=recent.rows[0],ongoing=open.rows[0];
  const material=ctx.material|| (latest?{grade:latest.grade,level:latest.level,op:latest.operation}:{});
  const s=await selection({...ctx,params:new URLSearchParams()},material);
  if(ctx.signal.aborted)return;
  const start=routeTo('start',{grade:s.grade,level:s.level,op:s.comp.operation});
  const next=ongoing?'session/'+encodeURIComponent(ongoing.attempt_id):start;
  const progress=ongoing?L('Lanjutkan soal '+(ongoing.index+1)+' dari '+ongoing.item_count,'Continue question '+(ongoing.index+1)+' of '+ongoing.item_count):t('start');
  const section=(title,path,label)=>e('div',{class:'section-head'},e('h2',{},title),link(path,[label,icon('arrow',16)],'text-link'));
  const topic=ongoing?tr(ongoing.package_title,ctx.lang)||t('title'+ongoing.operation):tr(s.comp.title,ctx.lang);
  const grade=ongoing?.grade||s.grade,level=ongoing?.level||s.level;
  const resultLine=latest?.status==='completed'&&Number.isInteger(latest.metrics?.C)&&latest.metrics.N>0?
    L(latest.metrics.C+' dari '+latest.metrics.N+' soal benar.',latest.metrics.C+' of '+latest.metrics.N+' correct.'):null;
  const activity=latest?e('div',{class:'activity panel'},e('span',{class:'row-icon'},icon('clock',22)),e('div',{},e('h3',{},t('title'+latest.operation)+' · '+t('material')+' '+latest.grade),e('p',{},[t('level')+' '+latest.level,t(latest.status==='completed'?'completed':latest.status==='ongoing'?'ongoing':'incomplete'),new Intl.DateTimeFormat(ctx.lang,{dateStyle:'medium'}).format(new Date(latest.started_at))].join(' · ')),resultLine?e('p',{class:'last-result'},resultLine):null),link((latest.status==='ongoing'?'session/':'results/')+encodeURIComponent(latest.attempt_id),[t(latest.status==='ongoing'?'continue':'seeResult'),icon('next',15)],'text-link')):e('div',{class:'activity panel'},e('span',{class:'row-icon'},icon('clock',22)),e('div',{},e('h3',{},t('noSession')),e('p',{},t('historyHelp'))));
  const matched=latest&&latest.grade===s.grade&&latest.level===s.level&&latest.operation===s.comp.operation;
  const time=ongoing?new Intl.DateTimeFormat(ctx.lang,{dateStyle:'medium',timeStyle:'short'}).format(new Date(ongoing.last_saved_at||ongoing.started_at)):'';
  const reason=ongoing?(ongoing.last_saved_at?t(storage.temporary?'lastTemporary':'lastSaved'):t('startedAt'))+' · '+time:matched?t('lastTopic'):ctx.material?t('yourChoice'):t('firstTopic');
  const lesson=e('section',{class:'lesson-strip'},
    e('div',{class:'lesson-intro'},e('span',{class:'lesson-label'},icon(ongoing?'clock':'book',18),t(ongoing?'resume':'practiceMode')),
      e('h2',{},topic),e('p',{class:'lesson-meta'},t('material')+' '+grade+' · '+t('level')+' '+level+' · '+(ongoing?t(ongoing.mode+'Mode'):questionCount(Math.min(10,s.entry.question_count),ctx.lang)+' · '+t('untimed'))),
      e('p',{class:'lesson-reason'},reason),
      e('div',{class:'lesson-actions'},link(next,[progress,icon('arrow',19)],'btn primary'),link(ongoing?start:routeTo('curriculum',{grade}),t(ongoing?'newSession':'changeTopic'),'text-link'))),
    e('div',{class:'lesson-visual','aria-hidden':'true'},e('span',{class:'abacus-line'},[0,1,2,3,4,5,6].map(()=>e('i'))),e('span',{class:'abacus-line'},[0,1,2,3,4].map(()=>e('i'))),e('span',{class:'abacus-line'},[0,1,2].map(()=>e('i')))));
  root.replaceChildren(e('div',{class:'home-head'},e('h1',{},t('home')),e('span',{class:'device-info'},icon('save',16),t(storage.temporary?'temporaryMode':'device'))),lesson,
    e('section',{class:'home-section'},section(t('latest'),'history',t('allHistory')),activity),
    e('section',{class:'home-section'},section(t('browse'),'curriculum',t('allClasses')),e('div',{class:'band-grid'},bands.map(b=>bandCard(ctx,b))),link('start?grade=1&level=1&op=ADD&orientation=1',t('notSure'),'text-link')),
    e('p',{class:'privacy-line'},icon('user',16),t(storage.temporary?'storageTemp':'homePrivacy')));
}
