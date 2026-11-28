"""Required external observations. The same case specification drives the operator form and receipt validation."""
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlparse
import re

GATES = ('BANK-07','UX-09','DEVICE-02','DEVICE-03','A11Y-04','TEACH-03',
         'PILOT-01','PILOT-02','PILOT-03','REL-02','REL-03','PERF-03')
MOBILE = ['fraction_keyboard_caret','decimal','composition_enter','rotation_draft','safe_area',
          'tap_controls','restore_same_device','restore_other_device','offline_finish_next','reopen_session']
ACTORS = {
    'BANK-07': ('math-teacher','bilingual-reviewer'),
    'UX-09': ('device-operator','reviewer'), 'DEVICE-02': ('device-operator','reviewer'),
    'DEVICE-03': ('device-operator','reviewer'), 'A11Y-04': ('accessibility-operator','reviewer'),
    'TEACH-03': ('word-operator','reviewer'), 'PILOT-01': ('pilot-moderator','reviewer'),
    'PILOT-02': ('pilot-moderator','reviewer'), 'PILOT-03': ('pilot-moderator','reviewer'),
    'REL-02': ('hosting-operator','reviewer'), 'REL-03': ('hosting-operator','reviewer'),
    'PERF-03': ('field-operator','reviewer'),
}
ROSTER = 'evidence/v15/review/roster-394-templates.csv'


def require(condition, msg):
    if not condition:
        raise ValueError(msg)


def meaningful(value):
    return (isinstance(value,str) and bool(value.strip()) and
            value.strip().lower() not in {'todo','tbd','n/a','none','null','pass','ok','fail','...','-','placeholder'})


def utc(value):
    require(isinstance(value,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z',value), 'UTC timestamp required')
    return datetime.fromisoformat(value.replace('Z','+00:00'))


def origin(url):
    p=urlparse(url)
    host=p.hostname or ''
    require(p.scheme=='https' and '.' in host and p.username is None and p.password is None and not p.fragment,'Final HTTPS URL required')
    require(not any(host==s or host.endswith('.'+s) for s in ('localhost','local','test','invalid','example','example.com','example.org','example.net')), 'Public target required')
    try: address=ip_address(host)
    except ValueError: pass
    else: require(address.is_global,'Local network target prohibited')
    return p.scheme+'://'+p.netloc.lower()


def roster(root):
    with (root/ROSTER).open(encoding='utf-8-sig',newline='') as f:
        rows=list(csv.DictReader(f))
    result={r['template_id']:r for r in rows}
    require(len(rows)==len(result)==394,'Expected 394 distinct template families')
    return result


def cases(root,gate):
    """Return the required case topology and blank operator fields for one criterion."""
    out={}
    def add(key, checks, env=None, measures=None, artifact_kinds=('observation',)):
        out[key]={'case_id':key,'environment':env or {},'checks':dict.fromkeys(checks,''),
                  'measurements':measures or {},'artifact_ids':[],'result':None,
                  'required_artifact_kinds':list(artifact_kinds)}
    versions={'model':'','os_version':'','app_version':''}
    if gate=='BANK-07':
        for key,r in roster(root).items():
            add(key,['mathematics','language_id','language_en','age_and_strategy','stage_and_order','boundary_case','decision_and_followup'],
                {'mode':'human-content-review','grade':int(r['grade'])},
                {**{k:r[k] for k in ('first_in_order','median_item','hardest_item')},'decision':None},('review-record',))
    elif gate=='UX-09':
        for os,app in [('Android','Chrome'),('iOS','Safari')]:
            for lang in ['id','en']:
                for rotation in ['portrait','landscape']:
                    add('-'.join([os.lower(),lang,rotation]),
                        ['keyboard_open','fraction','decimal','input_visible','oke_visible','feedback','next_visible','post_next_expression_visible','post_next_input_visible','post_next_input_ready',
                         'post_next_action_reachable','rotation_safe_area','signed_fraction_and_minus','draft','double_tap_final'],
                        {'mode':'physical','platform':os,'app':app,**versions,'keyboard':'','locale':lang,'orientation':rotation},
                        {'final_commits':None},('device-recording',))
    elif gate in ('DEVICE-02','DEVICE-03'):
        os,app=('Android','Chrome') if gate=='DEVICE-02' else ('iOS','Safari')
        for keyboard in (['gboard','alternate'] if os=='Android' else ['system']):
            add(keyboard,MOBILE+['portrait_keyboard','landscape_keyboard','decimal_id','decimal_en']+(['files_download'] if os=='iOS' else []),
                {'mode':'physical','platform':os,'app':app,**versions,'keyboard':''},
                {'taps':20,'mistaps':None,'restore_target_model':''},('device-recording','backup-check'))
    elif gate=='A11Y-04':
        for at,platform,app in [('NVDA','Windows','Chrome|Firefox'),('VoiceOver','iOS|macOS','Safari'),('TalkBack','Android','Chrome')]:
            for lang in ['id','en']:
                add(at.lower()+'-'+lang,['spoken_fraction','spoken_mixed','feedback_order','focus','map_status','help','result','invalid_1_over_0'],
                    {'mode':'actual-speech','at':at,'at_version':'','platform':platform,'app':app,**versions,'locale':lang},
                    artifact_kinds=('speech-record',))
    elif gate=='TEACH-03':
        for doc in ('supplied-fixture','new-export'):
            add(doc,['opened_in_word','numerator','denominator','grouping','minus','all_equations_compared'],
                {'mode':'visual-word-render','app':'Microsoft Word','platform':'Windows|macOS',**versions},
                {'equations_checked':None,'incorrect_equations':None},('docx','word-render','comparison'))
    elif gate in ('PILOT-01','PILOT-02'):
        learner=gate=='PILOT-01'
        for i in range(12 if learner else 3):
            add(('s' if learner else 't')+f'{i+1:02}',(['choose_start','launch','wrong_answer_feedback','continue','reopen'] if learner else
                ['find_difficulty','distinguish_first_and_revision','choose_next']),{'mode':'observed-pilot','participant_role':'student' if learner else 'teacher',
                'material_group':'early|middle|upper' if learner else 'teacher','device':'','app_version':''},
                {'permission_confirmed':None,'critical_data_failure':None,'dead_end':None,'elapsed_seconds':None,'mistaps':None,'moderator_notes':'',
                 **({'start_unassisted':None,'continue_unassisted':None} if learner else {'understands_report':None})},('pilot-log',))
    elif gate=='PILOT-03':
        add('findings-and-retest',['review_student_observations','review_teacher_observations','issue_triage','fix_and_retest'],
            {'mode':'human-pilot-review'},{'student_events':[],'teacher_events':[],'issues':[],'no_change_rationale':''},('pilot-log','review-record'))
    elif gate=='REL-02':
        add('final-deployment',['https','routes','subpath','headers','mime','404','build_info','offline_release','dist_hash'],
            {'mode':'authorized-deployment','candidate_url':'','deployment_id':'','client_version':''},
            {'served_release':'','served_dist_sha256':''},('http-capture','deployment-record'))
    elif gate=='REL-03':
        for key in ('device-1','device-2'):
            add(key,['install_offline','active_old_tab','draft_on_update','finish_old_session','close_tabs','activate_new_worker','rollback',
                     'history_after_rollback','offline_play_after_rollback'],
                {'mode':'authorized-deployment','candidate_url':'','deployment_id':'',**versions},
                {'before_deployment':'','after_deployment':'','rollback_deployment':'','before_release':'','after_release':'','rollback_release':'',
                 'before_dist_sha256':'','after_dist_sha256':'','rollback_dist_sha256':'','device_alias':''},
                ('deployment-record','device-recording'))
    elif gate=='PERF-03':
        add('field-sample',['actual_users','post_pilot_window','collection_method','privacy','p75_calculation'],
            {'mode':'real-user-field','candidate_url':'','deployment_id':'','instrument_version':''},
            {'start_utc':'','end_utc':'','lcp_ms':[],'inp_ms':[],'cls':[]},('field-measurements',))
    else:
        raise ValueError('Unknown external criterion')
    return out


def validate_case(case, spec, artifacts, gate, identity, trust):
    require(case.get('result') in ('PASS','FAIL'),'Missing observed result')
    env=case['environment']; measures=case['measurements']
    require(isinstance(env,dict) and isinstance(measures,dict) and isinstance(case.get('checks'),dict),'Malformed scenario')
    for key,target in spec['environment'].items():
        value=env.get(key)
        if isinstance(target,int): require(value==target,'Wrong grade for template')
        elif target: require(value in target.split('|'),f'Unsupported {key}')
        else: require(meaningful(value),f'Missing {key}')
    require(all(meaningful(case['checks'].get(k)) for k in spec['checks']),'Missing direct observation for required step')
    ids=case['artifact_ids']
    require(isinstance(ids,list) and ids and len(ids)==len(set(ids)) and all(x in artifacts for x in ids),'Evidence reference missing')
    require(set(spec['required_artifact_kinds']) <= {artifacts[i]['kind'] for i in ids},'Missing required evidence type')
    require(measures.keys()>=spec['measurements'].keys(),'Incomplete measurements')
    if env.get('mode')=='physical':
        require(all(not any(x in env[k].lower() for x in ('emulat','simulat','viewport','headless')) for k in ('model','os_version','app_version','keyboard')), 'Emulator cannot certify a physical device')
    ok=case['result']=='PASS'
    def number(key):
        n=measures[key];require(type(n) is int and n>=0,'Expected nonnegative integer '+key);return n
    def flag(key):
        n=measures[key];require(type(n) is bool,'Expected true/false for '+key);return n
    if gate=='BANK-07':
        require(all(measures[k]==spec['measurements'][k] for k in ('first_in_order','median_item','hardest_item')),'Roster occurrence references do not match candidate')
        require(measures['decision'] in ('setuju','perbaiki_urutan','perbaiki_isi','tolak'),'Missing instructional and bilingual review decision')
        ok &= measures['decision']=='setuju'
    if gate=='UX-09': ok &= number('final_commits')==1
    if gate in ('DEVICE-02','DEVICE-03'):
        require(meaningful(measures['restore_target_model']),'Missing restore target')
        name=env['keyboard'].casefold()
        if gate=='DEVICE-02':
            require(('gboard' in name)==(case['case_id']=='gboard'),'Distinct Gboard and second IME required')
        ok &= number('taps')==20 and number('mistaps')<=1
    if gate=='TEACH-03':
        ok &= number('equations_checked')>0 and number('incorrect_equations')==0
    if gate in ('PILOT-01','PILOT-02'):
        require(flag('permission_confirmed'),'Pilot permission missing')
        number('elapsed_seconds');number('mistaps')
        require(meaningful(measures['moderator_notes']),'Missing moderator observation')
        ok &= not flag('critical_data_failure') and not flag('dead_end')
        if gate=='PILOT-01':
            flag('start_unassisted');flag('continue_unassisted')
        else: ok &=flag('understands_report')
    if gate=='PILOT-03':
        require(isinstance(measures['issues'],list),'Invalid issue list')
        if not measures['issues']: require(meaningful(measures['no_change_rationale']),'Review rationale required when no change was needed')
        for issue in measures['issues']:
            require(all(meaningful(issue.get(x)) for x in ('finding','action','retest_observed','before_release','after_release')),'Missing change/retest evidence')
            require(issue['after_release']==identity['offline_release'] and re.fullmatch('[0-9a-f]{16}',issue['before_release']),'Retest on different build')
            require(issue.get('artifact_id') in ids,'Retest requires an artifact')
            ok &=issue.get('retest_result')=='PASS'
    if gate.startswith('REL-') or gate=='PERF-03':
        base=origin(env['candidate_url'])
        targets=[t for t in trust['targets'] if t.get('origin')==base]
        require(len(targets)==1 and env['deployment_id'] in targets[0]['deployment_ids'],'Unauthorized origin or deployment ID')
    if gate=='REL-02':
        ok &=measures['served_release']==identity['offline_release'] and measures['served_dist_sha256']==identity['dist_tree_sha256']
    if gate=='REL-03':
        require(all(measures[k+'_deployment'] in targets[0]['deployment_ids'] for k in ('before','after','rollback')),'Unauthorized rollout deployment')
        require(measures['before_deployment']!=measures['after_deployment'] and env['deployment_id']==measures['after_deployment'],'Missing deployment transition')
        require(meaningful(measures['device_alias']),'Distinct physical device alias required')
        require(bool(re.fullmatch('[0-9a-f]{16}',measures['before_release'])) and bool(re.fullmatch('[0-9a-f]{64}',measures['before_dist_sha256'])),'Missing prior build hashes')
        ok &= (measures['after_release']==identity['offline_release'] and measures['after_dist_sha256']==identity['dist_tree_sha256']
               and measures['before_release']!=measures['after_release'] and measures['rollback_release']==measures['before_release']
               and measures['rollback_dist_sha256']==measures['before_dist_sha256'])
    if gate=='PERF-03':
        require(utc(measures['start_utc']) < utc(measures['end_utc']) <= datetime.now(timezone.utc),'Invalid field measurement window')
        for key,limit in [('lcp_ms',2500),('inp_ms',200),('cls',Decimal('0.1'))]:
            raw=measures[key];require(isinstance(raw,list) and len(raw)>0,'Missing field samples')
            values=[]
            for n in raw:
                require(isinstance(n,(int,float,str)) and not isinstance(n,bool),'Invalid field measurement')
                try: value=Decimal(str(n))
                except InvalidOperation: raise ValueError('Invalid field measurement')
                require(value.is_finite() and value>=0,'Invalid field measurement');values.append(value)
            # Nearest rank, ordered raw per-metric observations; do not substitute lab summaries.
            ok &= sorted(values)[(3*len(values)+3)//4-1]<=limit
    return bool(ok)
