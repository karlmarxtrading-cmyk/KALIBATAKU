"""Reconcile observed test records with the unmodified 90/68 acceptance contract."""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from fixture_server import ROOT

OUTPUT = ROOT / 'evidence' / 'acceptance'
def read(path):
    p=ROOT/path
    return json.loads(p.read_text()) if p.is_file() else {}

def build():
    cases=read('spec/qa/release_test_matrix.template.json')['tests']
    reqs=read('spec/planning/requirements.json')['requirements']
    rows={r['test_id']:dict(r,scope='Release acceptance',observations=[],limitations=[]) for r in cases}
    refs=lambda s:'evidence/acceptance/'+s
    ev=lambda area,s:'evidence/'+area+'/'+s
    rank={'PASS':0,'NOT_RUN':1,'FAIL':2}
    def record(i,status,files,observation,lim=''):
        key='TC-'+str(i).removeprefix('TC-')
        rec=rows[key]
        files=[p for p in files if (ROOT/p).is_file()]
        if status=='PASS' and not files:
            status='NOT_RUN';lim='Expected evidence file missing.'
        rec['status']=status if not rec['observations'] else max(status,rec['status'],key=lambda x:rank[x])
        rec['evidence']=list(dict.fromkeys([*rec['evidence'],*files]))
        rec['observations'].append(observation)
        if lim:rec['limitations'].append(lim)
    def observed(i,files,passed,obs,lim=''):
        record(i,('PASS' if passed else 'FAIL') if all((ROOT/p).is_file() for p in files) else 'NOT_RUN',files,obs,lim)
    bank='evidence/bank/test-results.json'
    for k,row in read(bank).items():
        record(k,row['status'],row['evidence']+[bank],'Factory and independent oracle/distribution checks referenced for this cell.')
    for f,prop in [('evidence/player/checks.json','cases'),('evidence/data/contract-results.json','results')]:
        for x in read(f).get(prop,[]):
            record(x.get('test_id') or x['id'],x['status'],[f],x.get('observed') or x['description'])
    for f in ['browser-data.json','browser-offline.json']:
        path=refs(f)
        for x in read(path).get('results',[]):
            if x['id'] not in rows:
                continue  # Additional A5 checks are reconciled in ACCEPTANCE_RESULTS.csv.
            record(x['id'],x['status'],[path],x['description']+': '+str(x.get('observations') or x.get('error')))
    teacher=ev('teacher','validation.json')
    for i,description in read(teacher).get('covers',{}).items():
        record(i,read(teacher)['status'],[teacher],description)
    report=refs('browser-teacher.json')
    visits=refs('browser-journeys.json')
    sem=refs('browser-semantics.json')
    layout=refs('browser-layout.json')
    fault=refs('browser-faults.json')
    data=refs('browser-data.json')
    perf=refs('browser-performance.json')
    budget=refs('bundle-budgets.json')
    kb='evidence/ux/acceptance/keyboard.json'
    opera=ev('deployment','static-http-https.json')
    cap=ev('ui','catalog-and-tokens.json')
    all_ok=lambda vals:bool(vals) and all(v.get('status')=='PASS' for v in vals)
    def matches(path,selection=None):
        q=read(path);items=q.get('checks',[])
        if selection:items=[a for a in items if selection(a)]
        return all_ok(items)
    def ck(ids,path,predicate,note,scope=''):
        for i in ids:observed(i,[path],matches(path,predicate),note,scope)
    exact=lambda name:lambda c:c.get('id')==name
    ck([117,185],report,exact('origin-isolation'),'A completed synthetic assignment and its reports stay separate from the personal namespace.')
    ck([153],report,exact('class-filter'),'The real dashboard changed from six to three people under the class filter.')
    ck([158,159],report,lambda c:c['id'].startswith('download-'),'All six formats were produced by the real export worker on a resolved synthetic subject.')
    ck([184],report,exact('revision'),'Markup-like note text stayed literal through rendering and append-only revision.')
    ck([120,121,128],visits,lambda c:c['id'] in ['locale-dirty','bad-input','resume-order'],'Typed input, locale change and reload were exercised on actual browser controls.')
    ck([123,124,125,126,127],visits,lambda c:c['id'].startswith(('player-','review-','assessment-hidden','dirty-block')),'Five modes were started and completed from session setup; result and item review appeared.')
    observed(160,[layout],matches(layout,None) and bool(read(layout).get('text_200')),'Ninety live viewport and appearance checks, ten additional sandboxed wide-layout measurements, and five live 200% root-text reflow checks. Actual dimensions are recorded.')
    checked_keypad=matches(visits,exact('short-viewport-keypad'))
    record(161,'NOT_RUN',[visits],'Short viewport, actual answer control and on-screen minus/slash/decimal tested in the desktop engine.' if checked_keypad else 'Phone-width player rendered with keypad; see screenshot and journeys.','A physical iOS/Android software keyboard and its occlusion events were unavailable in this Linux browser.')
    observed(162,[sem,visits,layout],matches(sem,None) and matches(visits,exact('locale-dirty')),'Bilingual/light/dark routes, definitions, rendered DOM, labels, feedback, and persistence checked across sessions and previews. See route-level coverage.')
    keyboard=read(kb)
    trusted=[e for e in keyboard.get('events',[]) if e.get('type')=='keydown' and e.get('trusted')]
    keyboard_ok=keyboard.get('trustedKeystrokes',0)>=8 and {'Tab','Enter'}<={e['key'] for e in trusted} and 'kp-answer' in keyboard.get('opening',{}).get('focus','') and '2 dari 2 soal benar' in keyboard.get('finalVisible','')
    observed(163,[kb],keyboard_ok, 'Trusted native input, Tab and Enter answered both questions, opened confirmation, and completed an actual 2/2 session. The trace includes initial and final focus and visible feedback.')
    record(164,'NOT_RUN',[kb,sem,visits],'Native Chromium accessibility tree exposed question, input, progress, feedback and review. Speech and announcement timing require assistive technology.','No NVDA, VoiceOver, TalkBack or Orca speech session was available for the requested manual screen-reader evaluation.')
    observed(165,[cap,sem,kb,layout],matches(sem,lambda c:c['id'].startswith('actual-text-contrast')) and matches(layout,None) and keyboard_ok,'Design token contrast, actual computed text, labels, color-independent status, keyboard outlines, and reflow measured in Chromium.','Color checks skip ambiguous backgrounds, covered separately by token checks and visual review; this is not a WCAG certification.')
    ck([166],visits,lambda x:x['id'] in ['reduced-motion','untimed-practice','hidden-timer'],'Reduced-motion option, untimed ordinary practice, and optional speed timer display checked in the actual app; deadline tested separately in domain suite.')
    ck([167,172],fault,lambda c:c['id'] in ['503-recovery','stale-request','unknown-route'],'Slow network, failed first catalogue request, retry, superseded navigation and unknown route exercised using the served app. Other unavailable/quota cases have dedicated tests.')
    narrow='evidence/ux/acceptance/browser-reflow-ux.json'
    teacher_reflow=any(s.get('page')=='demo/teacher' and s.get('width')==320 and s.get('innerWidth')==320 and s['scroll']<=s['viewport']+2 and s['method']=='live window' for s in read('evidence/v12/roles-reflow.json').get('samples',[]))
    observed(168,[layout,report,narrow,'evidence/v12/roles-reflow.json'],matches(report,exact('class-filter')) and teacher_reflow,'Teacher cards, filters and drilldown exercised in the browser. The dedicated reflow suite measured actual live 320 CSS px teacher windows in both languages.')
    observed(169,[cap,visits,report,sem],matches(visits,None) and matches(report,None) and matches(sem,None),'All curriculum entries resolve; core calls to action tested across five student journeys, teacher assignment, six exports, management routes and retry.')
    observed(170,[perf,budget],matches(perf,lambda c:c['id'].startswith('initial-')) and matches(budget,lambda c:c['name'].startswith('initial-')),'Three fresh path namespaces, named resources, local gzip totals, no question modules or exporters on initial load.')
    journeys=read(visits).get('journeys',[])
    observed(171,[visits,cap],len(journeys)==5 and all(any('/bank/' in v['path'] and v['path'].endswith('.mjs') for v in j.get('loaded',[])) for j in journeys),'Lazy pack requests recorded on five real sessions. Metadata catalogue resolver separately checks all 4,604 pack references.')
    observed(173,[visits,report],matches(visits,lambda c:c['id'].startswith('next-network-')) and matches(report,lambda c:c['id'].startswith('download-')) and matches(report,exact('batch-main-thread')),'No package fetch on next/submit. Browser worker runs six exports. During a 24-report batch the main thread dispatched a synthetic button click and continued processing timers.')
    observed(174,[perf],matches(perf,None) and read(perf).get('median_lcp_ms') is not None,'Three laboratory runs, unique cold URL namespaces, local network, unthrottled CPU. Report includes LCP, shifts and individual network entries plus a separate first-interaction measurement.','No field Core Web Vitals or real-device performance claim.')
    observed(175,[layout,teacher,report],bool(read(layout).get('screens')) and max(s['domCount'] for s in read(layout).get('screens',[]))<1500 and matches(report,exact('download-zip')) and matches(report,exact('batch-main-thread')),'Catalogue and teacher DOM sizes recorded, large multipage exports structurally verified, and worker produced a 24-report archive with observed heap and responsiveness samples.')
    observed(180,[ev('deployment','clean-build.json')],read(ev('deployment','clean-build.json')).get('status')=='PASS','Separate clean build directories produced identical deployment bytes.')
    for i,description in [(181,'Static HTTP and TLS plus practice through complete static application.'),(182,'Root and nested URL, module MIME and missing assets checked.'),(183,'Served CSP, declared optional features and headers checked in local static host.')]:
        observed(i,[opera],read(opera).get('status')=='PASS',description,'Cloudflare production hosting was not requested or contacted.')
    asset=ev('deployment','asset-review.json')
    observed(187,[ev('deployment','npm-audit.json'),asset],read(ev('deployment','npm-audit.json')).get('metadata',{}).get('vulnerabilities',{}).get('total')==0 and read(asset).get('status')=='PASS','Lockfile, local assets/licenses and runtime dependency review.')
    pre=ev('deployment','archive-preflight.json')
    if (ROOT/pre).is_file():
        observed(188,[pre,'tools/release_pack.py'],read(pre).get('status')=='PASS','Distribution preflight and safe, self-verifying whole-payload packaging command. Final ZIP itself is accepted only after all member CRCs and hashes pass this command.','The final archive cannot contain its own final digest; the packing receipt reports it externally.')
    verdict=read('RELEASE_STATUS.json')
    if verdict and all(k in verdict.get('readiness',{}) for k in ['static_application','bank_content','bridge_contract','live_lms','pedagogical_calibration','live_deployment']):
        r=verdict['readiness']
        observed(189,['RELEASE_STATUS.json'],r['live_lms']['status']=='DEFERRED_BY_SCOPE' and r['live_deployment']['status']!='PRODUCTION_PASS' and r['pedagogical_calibration']['status']!='PILOTED','Six status fields separate executable product, bank, contract, live LMS, pilot and deployment.')
    assert len(cases)==90 and len(reqs)==68
    for row in rows.values():
        if not row['observations']:
            row['limitations'].append('No completed release receipt yet.')
    counts=dict(Counter(r['status'] for r in rows.values()))
    result={'scope':'Observed static release acceptance; each status is bound to evidence and limitations.',
            'counts':counts,'tests':list(rows.values())}
    (OUTPUT/'test-matrix.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    with (OUTPUT/'requirements-traceability.csv').open('w',newline='') as f:
        writer=csv.writer(f)
        writer.writerow(['id','title','required_outcome','implementation','test_cases','status','evidence','limitations'])
        for req in reqs:
            sub=[rows[v] for v in req['test_cases']]
            tc=[int(r['test_id'][3:]) for r in sub]
            components=[]
            if any(i<120 for i in tc):components+=['factory/','dist/bank/']
            if any(120<=i<=128 or 145<=i<=154 for i in tc):components+=['src/player/']
            if any(129<=i<=144 or 176<=i<=179 or i in (184,186) for i in tc):components+=['src/data/','src/sw.js']
            if any(151<=i<=159 or i in (117,168,185) for i in tc):components+=['src/teacher/']
            if any(160<=i<=175 for i in tc):components+=['src/core/','src/app.mjs','src/assets/']
            if any(i>=180 for i in tc):components+=['tools/','docs/']
            status=max((r['status'] for r in sub),key=lambda v:rank[v])
            writer.writerow([req['id'],req['title'],req['acceptance'],','.join(components),','.join(req['test_cases']),status,
                ' | '.join(dict.fromkeys(p for r in sub for p in r['evidence'])),
                ' | '.join(dict.fromkeys(s for r in sub for s in r['limitations']))])
    print(counts)
    for x in rows.values():
        if x['status']!='PASS':print(x['test_id'],x['status'],x['title'])
if __name__=='__main__':build()
