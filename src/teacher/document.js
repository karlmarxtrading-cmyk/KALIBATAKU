import {utcTimestamp} from '../data/time.js';
import {tokens,linear,asRational,decimalPreference} from '../math/model.mjs';
import {tr,name,fmt,dateAt,originLabel,nextStep} from './report.js';
export const safeName=s=>String(s??'report').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,55)||'report';
export function fileStem(s){return ['KALIBATAKU','Report',safeName(s.person.id),safeName((s.filters.from||'all')+'_'+(s.filters.to||'all')),s.core.locale,'v1'].join('_');}
function technicalModel(s) {
  const l=s.core.locale,t=(a,b)=>tr(l,a,b),p=n=>fmt(n,l),m=s.counts,period=(s.filters.from||'…')+' — '+(s.filters.to||'…')+' · '+s.core.display_timezone;
  const masteryName=m=>({
    not_started:t('Belum dievaluasi','Not assessed'),insufficient_evidence:t('Bukti terbatas','Limited evidence'),developing:t('Sedang berkembang','Developing'),mastered_provisional:t('Dikuasai sementara','Provisionally mastered')
  }[m]||'—');
  const headings={ops:t('Profil operasi','Operation profile'),comp:t('Kompetensi yang dikerjakan','Attempted competencies'),sess:t('Riwayat sesi','Session history')};
  const info=t('Sesi selesai','Completed sessions')+' '+s.completed+' · '+t('Sedang berjalan','In progress')+' '+s.ongoing;
  const empty=t('Belum ada hasil','No results yet');
  const table=(headers,rows,widths)=>({kind:'table',headers,rows,widths});
  const heading=text=>({kind:'h',text}), paragraph=text=>({kind:'p',text});
  let blocks=[paragraph(originLabel(s.core.data_origin,l)),heading(s.person.alias),
    paragraph(t('Kelas administratif','Administrative class')+' '+(s.person.classId||'—')+' · '+period),paragraph(info),
    table([t('Ukuran','Measure'),t('Hasil','Result'),t('Perhitungan','Calculation')],[
      [t('Skor paket','Form score'),p(m.score),m.C+' / '+m.N],
      [t('Akurasi jawaban','Response accuracy'),p(m.accuracy),m.C+' / '+(m.C+m.W)],
      [t('Soal ditanggapi','Questions responded to'),p(m.responded),(m.C+m.W+m.S)+' / '+m.N],
      [t('Jawaban pertama benar','First response correct'),m.firstTotal?p(100*m.firstCorrect/m.firstTotal):p(null),m.firstCorrect+' / '+m.firstTotal],
    ],[.47,.29,.24]),paragraph(t('Benar','Correct')+' '+m.C+' · '+t('Salah','Incorrect')+' '+m.W+' · '+t('Dilewati','Skipped')+' '+m.S+' · '+t('Kosong','Blank')+' '+m.B+' · '+t('Belum dilihat','Unseen')+' '+m.U),
    heading(headings.ops),table([t('Operasi','Operation'),t('Benar / soal','Correct / items'),t('Skor','Score')],s.operations.map(g=>[name(l,g.operation),g.C+' / '+g.N,p(g.score)]),[.39,.31,.30]),
    heading(t('Langkah berikutnya','Next step')),paragraph(nextStep(s,l))];
  if(s.change_pp!=null){
    const d=new Intl.NumberFormat(l==='id'?'id-ID':'en-GB',{signDisplay:'exceptZero',maximumFractionDigits:1}).format(s.change_pp);
    blocks.push(paragraph(t('Perubahan dua evaluasi sebanding','Change across two comparable assessments')+' '+d+' '+t('poin persentase','percentage points')+'.'));
  }
  if(s.competencies.length){blocks.push(heading(headings.comp),table([t('Kelas · Level','Grade · Level'),t('Operasi','Operation'),t('Benar / soal','Correct / items')],s.competencies.map(g=>[g.grade+' · '+g.level,name(l,g.operation),g.C+' / '+g.N]),[.32,.38,.30]));}
  if(s.competencies.length){
    blocks.push(heading(t('Bukti penguasaan','Mastery evidence')),
      table([t('Kompetensi','Competency'),t('Unik / target','Unique / target'),t('Status','Status')],s.competencies.map(c=>[c.id,c.mastery.unique+' / '+c.mastery.needed,masteryName(c.mastery.status)]),[.40,.25,.35]));
    const tested=s.operations.filter(g=>g.N),strong=tested.filter(g=>g.C+g.W>=8).sort((a,b)=>b.accuracy-a.accuracy)[0];
    if(strong)blocks.push(paragraph(t('Ketepatan yang teramati pada '+name('id',strong.operation).toLowerCase()+': '+strong.C+' dari '+(strong.C+strong.W)+' jawaban benar.',
      'Observed accuracy in '+name('en',strong.operation).toLowerCase()+': '+strong.C+' correct out of '+(strong.C+strong.W)+' responses.')));
    const timing=s.timing;
    blocks.push(paragraph(t('Waktu respons benar pertama tanpa petunjuk','First correct response time without hints')+' · N = '+timing.n+' · '+(timing.median_ms==null?t('Perlu 10 observasi untuk median/P90.','Median/P90 require 10 observations.'):t('Median','Median')+' '+(timing.median_ms/1000).toFixed(2)+' s / P90 '+(timing.p90_ms/1000).toFixed(2)+' s')+' · '+t('Dikecualikan','Excluded')+' '+timing.excluded));
  }
  blocks.push(heading(t('Catatan dan keputusan guru','Teacher notes and decisions')));
  if(!s.notes.length)blocks.push(paragraph(t('Belum ada catatan dalam periode ini.','No notes in this period.')));
  for(const n of s.notes)blocks.push(paragraph((s.notes.find(child=>child.supersedes===n.id)?t('Digantikan','Superseded'):t('Berlaku','Current'))+' · '+dateAt(n.at,s.core.display_timezone,l)+' · '+n.author+' · '+(n.type==='override'?t('Keputusan guru','Teacher decision'):t('Catatan','Note'))+' r'+n.revision+' — '+n.text));
  blocks.push(heading(headings.sess));
  if(!s.sessions.length)blocks.push(paragraph(empty));
  else blocks.push(table([t('Tanggal','Date'),t('Materi','Material'),t('Mode · status','Mode · status'),t('Benar / soal','Correct / items')],s.sessions.map(a=>[
    dateAt(a.started,s.core.display_timezone,l),a.grade+' · L'+a.level+' · '+name(l,a.operation),name(l,a.mode)+' · '+name(l,a.status),a.status==='completed'?a.C+' / '+a.N:'—'
  ]),[.25,.21,.34,.20]));
  blocks.push(heading(t('Rincian laporan','Report details')),
    paragraph(t('Dibuat','Created')+' '+dateAt(s.core.created_at,s.core.display_timezone,l)+' · '+s.core.display_timezone),
    paragraph(s.core.report_id+' · '+s.core.policy_version+' · '+t('Versi konten','Content versions')+' '+(s.content_versions.join(', ')||'—')),
    paragraph(t('Modul','Module')+' '+s.filters.module+' · '+t('Filter','Filters')+' '+(Object.entries(s.filters).filter(([k,v])=>['grade','level','operation','mode','status','packageId'].includes(k)&&v).map(([k,v])=>
      ({grade:t('Kelas','Grade'),level:'Level',operation:t('Operasi','Operation'),mode:'Mode',status:'Status',packageId:t('Paket','Package')}[k])+'='+name(l,v)).join(' · ')||t('Semua','All'))));
  return {title:t('Laporan pertemuan orang tua','Parent meeting report'),blocks};
}
export function documentModel(s) {
  const l=s.core.locale,t=(id,en)=>tr(l,id,en);
  const h=text=>({kind:'h',text}),p=text=>({kind:'p',text});
  const all=t('Semua tanggal','All dates'),from=s.filters.from,to=s.filters.to;
  const period=from||to?(from||'…')+' — '+(to||'…'):all;
  const topic=c=>name(l,c.operation)+' · '+t('kelas','grade')+' '+c.grade+' · level '+c.level+' · '+name(l,c.mode);
  const contexts=s.contexts||[],observed=contexts.filter(c=>c.firstTotal);
  const strength=observed.filter(c=>c.independent>0).sort((a,b)=>b.independent-a.independent)[0];
  const need=observed.filter(c=>c.firstCorrect<c.firstTotal).sort((a,b)=>(b.firstTotal-b.firstCorrect)-(a.firstTotal-a.firstCorrect))[0];
  const unknown=operationsForReport(s).filter(op=>!contexts.some(c=>c.operation===op&&c.mode==='assessment'));
  const blocks=[p(originLabel(s.core.data_origin,l)),h(s.person.alias),p([s.person.classId,period,s.core.display_timezone].filter(Boolean).join(' · ')),
    p(t('Sesi selesai dalam periode ini: ','Completed sessions in this period: ')+s.completed+' · '+t('Berjalan: ','In progress: ')+s.ongoing),
    h(t('Yang sudah terlihat','What went well')),
    p(strength?topic(strength)+' — '+t(strength.independent+' dari '+strength.firstTotal+' soal yang dijawab benar pada upaya pertama tanpa bantuan.',strength.independent+' of '+strength.firstTotal+' answered questions were correct on the first try without help.'):t('Belum ada jawaban benar mandiri pada respons pertama yang tercatat dalam periode ini.','No independent first-try correct responses are recorded in this period.')),
    h(t('Fokus pendampingan','What to work on')),
    p(need?topic(need)+' — '+t((need.firstTotal-need.firstCorrect)+' dari '+need.firstTotal+' respons pertama perlu diperbaiki.',(need.firstTotal-need.firstCorrect)+' of '+need.firstTotal+' first responses needed correction.'):s.completed?t('Coba soal sejenis untuk melihat apakah hasilnya konsisten.','Try a similar question to see whether the result is consistent.'):t('Mulai dengan satu latihan pendek untuk mengenal cara siswa berpikir.','Start with a short practice session to see how the learner approaches questions.'))];
  if(contexts.length)blocks.push({kind:'table',headers:[t('Materi yang dikerjakan','Recent learning context'),t('Respons pertama benar','Correct on the first try')],rows:contexts.slice(0,3).map(c=>[topic(c),c.firstCorrect+' / '+c.firstTotal]),widths:[.65,.35]});
  const journey=s.journey;
  if(journey?.rows?.length){
    const cutoff=journey.as_of;
    const time=cutoff?dateAt(cutoff.utc,s.core.display_timezone,l)+' '+s.core.display_timezone:'';
    blocks.push(h(t('Kesiapan petualangan','Adventure readiness')),
      p(t('Kebijakan saat ini','Current policy')+' · '+journey.mission_policy+' · '+journey.exposure_policy+
        (time?' · '+(cutoff.inclusive?t('sampai','through'):t('sebelum','before'))+' '+time:'')+'. '+
        t('Cakupan menghitung soal unik yang pernah dilihat dalam sesi selesai, termasuk latihan di katalog.',
          'Coverage counts distinct questions viewed in completed sessions, including catalogue practice.')),
      {kind:'table',headers:[t('Keterampilan','Skill'),t('Misi lulus / target','Passes / target'),t('Soal unik / target','Unique / target'),
        t('Strategi / target','Strategies / target'),t('Siap lanjut','Ready to move on')],
       rows:journey.rows.map(r=>[r.grade+' · L'+r.level+' · '+name(l,r.operation),r.passing_missions+' / '+r.rule.target_missions,
         r.unique_seen+' / '+r.rule.coverage_needed,r.strategies_seen+' / '+r.rule.strategies_needed,
         r.ready?t('Siap','Ready'):t('Belum','Not yet')]),widths:[.30,.17,.18,.18,.17]},
      p(t('Misi dalam periode','Missions in period')+' '+journey.missions+' · XP '+journey.xp+' · '+
        t('respons pertama benar mandiri','independent correct first responses')+' '+
        journey.rows.reduce((v,r)=>v+r.first_independent,0)+' / '+journey.rows.reduce((v,r)=>v+r.first_total,0)+'. '+
        t('Kesiapan membuka keterampilan berikutnya. XP mencatat usaha. Evaluasi A/B mengukur penguasaan formal.',
          'Readiness unlocks the next skill. XP records effort. A/B assessments measure formal mastery.')));
  }
  const ex=s.firstDifficulty;
  if(ex){
    blocks.push(p(t('Contoh dari sesi','Example from the session')+' '+dateAt(ex.at,s.core.display_timezone,l)+' · '+name(l,ex.mode)));
    if(ex.expression_ast&&ex.key){
      for(const [label,ast,opts] of [[t('Soal','Question'),ex.expression_ast,{}],[t('Kunci jawaban','Correct answer'),asRational(ex.key),decimalPreference(ex)]]){
        const math=tokens(ast,l,opts);blocks.push({kind:'math',label,ast,opts,math,text:label+' · '+linear(math)});
      }
    }else blocks.push(p(ex.expression||'—'));
    if(ex.first_ast){
      const responses=[[t('Jawaban pertama','First response'),ex.first_ast]];
      if(ex.final!==ex.first&&ex.final_ast)responses.push([t('Jawaban terakhir','Last response'),ex.final_ast]);
      for(const [label,ast] of responses){const math=tokens(ast,l);blocks.push({kind:'math',label,ast,math,text:label+' · '+linear(math)});}
      if(ex.after_key||ex.hint)blocks.push(p([ex.after_key&&t('Revisi setelah melihat kunci.','Revised after seeing the answer.'),ex.hint&&t('Menggunakan petunjuk.','Hint used.')].filter(Boolean).join(' ')));
    }else blocks.push(p(t('Jawaban pertama','First response')+' · '+ex.first+(ex.final!==ex.first?' → '+ex.final:'')+(ex.after_key?' · '+t('direvisi setelah melihat kunci','revised after seeing the key'):'')+(ex.hint?' · '+t('menggunakan petunjuk','hint used'):'')));
  }
  if(unknown.length)blocks.push(p(t('Belum diuji melalui evaluasi pada periode ini','Not assessed in this period')+' — '+unknown.map(op=>name(l,op)).join(', ')+'.'));
  blocks.push(h(t('Rencana latihan berikutnya','Next practice plan')),p(s.plan||nextStep(s,l)),p(t('Tanggal tinjauan','Review date')+' · '+(s.reviewDate||t('Belum ditetapkan bersama guru.','To be agreed with the teacher.'))));
  const notes=s.activeNotes??s.notes;
  if(notes.length)blocks.push(h(t('Catatan guru yang berlaku','Current teacher notes')),...notes.map(n=>p(n.author+' · '+dateAt(n.at,s.core.display_timezone,l)+' · r'+n.revision+' — '+n.text)));
  if(s.appendix)blocks.push(h(t('Lampiran teknis','Technical appendix')),...technicalModel(s).blocks.slice(4));
  return {title:t('Laporan pertemuan orang tua','Parent meeting report'),blocks};
}
function operationsForReport(s){return s.filters.operation?[s.filters.operation]:s.operations.map(row=>row.operation);}
export function sheets(s){
  const l=s.core.locale,t=(a,b)=>tr(l,a,b), cols=[t('Soal','Assigned'),t('Benar','Correct'),t('Salah','Incorrect'),t('Dilewati','Skipped'),t('Kosong','Blank'),t('Belum dilihat','Unseen'),t('Skor (%)','Score (%)'),t('Akurasi (%)','Accuracy (%)'),t('Ditanggapi (%)','Responded (%)')];
  const nums=m=>[m.N,m.C,m.W,m.S,m.B,m.U,m.score,m.accuracy,m.responded];
  return [
    ['Summary',[[t('Siswa','Student'),t('Sumber','Source'),...cols],[s.person.alias,originLabel(s.core.data_origin,l),...nums(s.counts)]]],
    ['Competencies',[[t('Kompetensi','Competency'),t('Kelas','Grade'),'Level',t('Operasi','Operation'),...cols],...s.competencies.map(c=>[c.id,c.grade,c.level,name(l,c.operation),...nums(c)])]],
    ['Operations',[[t('Operasi','Operation'),...cols],...s.operations.map(c=>[name(l,c.operation),...nums(c)])]],
    ['Sessions',[['ID','UTC',t('Paket','Package'),t('Mode','Mode'),t('Status','Status'),...cols],...s.sessions.map(a=>[a.id,utcTimestamp(a.started),a.package,name(l,a.mode),name(l,a.status),...nums(a)])]],
    ['Dictionary',[[t('Ukuran','Measure'),t('Definisi','Definition')],...technicalModel(s).blocks.find(b=>b.kind==='table').rows.map(r=>[r[0],r[2]]),[t('Penyebut nol','Zero denominator'),t('Kosong = belum dievaluasi','Empty = not assessed')]]],
    ['Metadata',Object.entries({...s.core,subject_id:s.person.id,subject_alias:s.person.alias,...s.filters,content_versions:s.content_versions.join(', '),change_pp:s.change_pp,
      journey_policy:s.journey?.mission_policy,journey_exposure_policy:s.journey?.exposure_policy,journey_readiness_as_of_utc:s.journey?.as_of?.utc,
      journey_as_of_inclusive:s.journey?.as_of?.inclusive?1:0,journey_readiness_scope:s.journey?.readiness_scope,
      journey_activity_scope:s.journey?.activity_scope})],
    ['Notes',[[t('Penulis','Author'),'UTC',t('Revisi','Revision'),t('Catatan','Note'),'ID',t('Menggantikan','Supersedes'),'Status'],...s.notes.map(n=>[n.author,utcTimestamp(n.at),n.revision,n.text,n.id,n.supersedes,s.notes.some(r=>r.supersedes===n.id)?t('Digantikan','Superseded'):t('Berlaku','Current')])]],
    ['Math',[[t('Sumber','Source'),'ID',t('Ekspresi','Expression'),t('Pembilang kunci','Key numerator'),t('Penyebut kunci','Key denominator'),t('Respons pertama','First response'),t('Respons terakhir','Last response')],...(s.firstDifficulty?[ [s.core.data_origin,s.firstDifficulty.attempt,s.firstDifficulty.expression_ast?linear(tokens(s.firstDifficulty.expression_ast,l)):s.firstDifficulty.expression,s.firstDifficulty.key?.numerator||'',s.firstDifficulty.key?.denominator||'',s.firstDifficulty.first,s.firstDifficulty.final] ]:[])]],
    ['Family',documentModel({...s,appendix:false}).blocks.filter(b=>b.text).map(b=>[b.text])],
    ['Journey',[[t('Kompetensi','Competency'),t('Kelas','Grade'),'Level',t('Operasi','Operation'),
      t('Misi periode','Period missions'),t('Misi lulus kumulatif','Cumulative passes'),t('Soal unik kumulatif','Cumulative unique items'),
      t('Target cakupan','Coverage target'),t('Respons pertama mandiri periode','Period independent first responses'),t('Respons pertama periode','Period first responses'),
      t('Dengan bantuan periode','Period assisted'),t('Revisi setelah kunci periode','Period revised after key'),t('Siap lanjut','Ready to move on'),
      t('XP periode','Period XP'),t('Target misi lulus','Passing target'),t('Strategi kumulatif','Cumulative strategies'),t('Target strategi','Strategy target'),
      t('Misi kumulatif','Cumulative missions')],...(s.journey?.rows||[]).map(r=>[r.node_id,r.grade,r.level,name(l,r.operation),r.missions,r.passing_missions,
      r.unique_seen,r.rule.coverage_needed,r.first_independent,r.first_total,r.assisted,r.revised_after_key,r.ready?1:0,r.xp,r.rule.target_missions,
      r.strategies_seen,r.rule.strategies_needed,r.cumulative_missions])]],
    ['Contexts',[[t('Kelas','Grade'),'Level',t('Operasi','Operation'),'Mode',t('Respons pertama benar','First correct'),t('Jumlah respons pertama','First responses'),t('Dengan petunjuk','With hints'),...cols],...(s.contexts||[]).map(c=>[c.grade,c.level,name(l,c.operation),name(l,c.mode),c.firstCorrect,c.firstTotal,c.hintCount,...nums(c)])]]
  ];
}
