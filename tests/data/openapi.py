"""Generate and validate the public integration contract from the versioned event schema."""
import json
import re
from pathlib import Path
from copy import deepcopy
from jsonschema import Draft202012Validator
from fastapi.openapi.models import OpenAPI

base=Path(__file__).resolve().parents[2]
core=json.loads((base/'docs/contracts/core-1.2.schema.json').read_text())
use=['Rational','Provenance','AttemptContext','QuestionInstance','StartedPayload','AnswerPayload','SkippedPayload','FinalResponse','CompletedPayload','AbandonedPayload','Event','BatchReceipt','ReportSnapshot']
schemas=json.loads(json.dumps({k:core['$defs'][k] for k in use}).replace('#/$defs/','#/components/schemas/'))
ref=lambda n:{'$ref':'#/components/schemas/'+n}
string={'type':'string','minLength':1}
nullable={'type':['string','null']}
integer={'type':'integer','minimum':0}
timestamp={'type':'string','format':'date-time'}
array=lambda item:{'type':'array','items':item}
def obj(**props):return {'type':'object','properties':props,'required':list(props),'additionalProperties':False}
def flexible(**props):return {**obj(**props),'additionalProperties':True}
schemas.update({
    'Error':obj(error=obj(code=string,message_key=string,details={'type':'object'},retryable={'type':'boolean'},request_id=string)),
    'Capabilities':flexible(schema_versions=array(string),environment_id=string,max_events={'type':'integer','minimum':1,'maximum':100},max_bytes={'type':'integer','minimum':1,'maximum':262144}),
    'Identity':flexible(subject=string,environment_id=string,roles=array(string),institution_id=string),
    'Assignment':flexible(id=string,package_id=string,content_version=string,policy_version=string),
    'Assignments':obj(items=array(ref('Assignment')),next_cursor=nullable),
    'AttemptBinding':obj(attempt_id=string,package_id=string,content_version=string,assignment_id=nullable,policy_version=string),
    'AttemptBound':flexible(attempt_id=string,package_id=string,content_version=string,policy_version=string),
    'EventBatch':obj(schema_version={'const':'1.0.0'},batch_id=string,attempt_id=string,events={**array(ref('Event')),'minItems':1,'maxItems':100}),
    'CompletionRequest':obj(attempt_id=string,final_event_id=string,expected_event_count={'type':'integer','minimum':1}),
    'CompletionResult':flexible(attempt_id=string,status={'enum':['complete','requires_missing_events']},grading_state={'enum':['unverified','queued','verified','rejected']},missing_sequences=array({'type':'integer','minimum':1})),
    'Student':flexible(id=string,class_ids=array(string)),
    'Students':obj(items=array(ref('Student')),next_cursor=nullable),
    'Progress':flexible(items=array({'type':'object'}),data_origin={'const':'lms_client'},policy_version=string),
    'Analytics':flexible(items=array({'type':'object'}),denominator=integer,weighting=string,filters={'type':'object'},calculated_at=timestamp),
    'ReportRequest':obj(scope_type={'enum':['student','class']},scope_id=string,language={'enum':['id','en','bilingual']},format={'enum':['pdf','csv','xlsx','docx','json','zip']},filters={'type':'object'},policy_version=string),
    'ReportJob':flexible(report_job_id=string,status={'enum':['queued','working','ready','failed']},completed=integer,total=integer,failures=array({'type':'object'}))
})
spec={'openapi':'3.1.0','info':{'title':'KALIBATAKU • LMS Bridge','version':'1.0.0','description':'Future same-origin authenticated LMS contract. Static distribution has no configured live endpoint.'},
      'servers':[{'url':'/api/v1'}],'security':[{'session':[]}],'paths':{},'components':{'schemas':schemas,'securitySchemes':{'session':{'type':'apiKey','in':'cookie','name':'session'},
      'csrf':{'type':'apiKey','in':'header','name':'X-CSRF-Token'}}}}
calls=[
 ('GET','/capabilities','getCapabilities',None,'Capabilities'),
 ('GET','/me','getIdentity',None,'Identity'),
 ('GET','/assignments','listAssignments',None,'Assignments'),
 ('POST','/attempts','startAttempt','AttemptBinding','AttemptBound'),
 ('POST','/events/batch','sendEventBatch','EventBatch','BatchReceipt'),
 ('POST','/attempts/complete','completeAttempt','CompletionRequest','CompletionResult'),
 ('GET','/students','listStudents',None,'Students'),
 ('GET','/students/{id}/progress','getProgress',None,'Progress'),
 ('GET','/students/{id}/analytics','getStudentAnalytics',None,'Analytics'),
 ('GET','/classes/{id}/analytics','getClassAnalytics',None,'Analytics'),
 ('POST','/reports','requestReport','ReportRequest','ReportJob'),
 ('GET','/reports/{id}','getReportStatus',None,'ReportJob'),
 ('GET','/reports/{id}/download','downloadReport',None,None)]
media=lambda n:{'application/json':{'schema':ref(n)}}
for method,path,op,req,resp in calls:
    result={'operationId':op,'responses':{'200':{'description':'Authorized result','content':media(resp) if resp else {'application/octet-stream':{'schema':{'type':'string','format':'binary'}}}},
      'default':{'description':'Request failed. Retry only when retryable and honor Retry-After.','content':media('Error')}}}
    if req:
        result.update({'requestBody':{'required':True,'content':media(req)},'security':[{'session':[],'csrf':[]}]})
    params=[]
    if '{id}' in path:params.append({'in':'path','name':'id','required':True,'schema':string})
    if op in ['listAssignments','listStudents','getProgress','getStudentAnalytics','getClassAnalytics']:
        for name in ['cursor','from','to','module','mode','grade','level','competency_id']:params.append({'in':'query','name':name,'schema':string})
    if params:result['parameters']=params
    spec['paths'][path]={method.lower():result}

def validate_local_refs(value):
    if isinstance(value,dict):
        if '$ref' in value:
            node=spec
            for key in value['$ref'].removeprefix('#/').split('/'):node=node[key]
        for x in value.values():validate_local_refs(x)
    if isinstance(value,list):
        for x in value:validate_local_refs(x)
validate_local_refs(spec)
OpenAPI.model_validate(spec)
for s in schemas.values():Draft202012Validator.check_schema(s)
for name,path in [('Event','ANSWER_EVENT_EXAMPLE'),('BatchReceipt','MOCK_ACK_EXAMPLE'),('ReportSnapshot','REPORT_SNAPSHOT_EXAMPLE')]:
    Draft202012Validator({'$ref':'#/components/schemas/'+name,'components':spec['components']}).validate(json.loads((base/f'spec/examples/{path}.json').read_text()))
(base/'docs/bridge/openapi.json').write_text(json.dumps(spec,indent=2,ensure_ascii=False)+'\n')
(base/'evidence/data/openapi-validation.json').write_text(json.dumps({'status':'PASS','validator':'FastAPI OpenAPI.model_validate + JSON Schema Draft202012Validator + recursive local-ref resolution','version':'3.1.0','operations':len(calls),'component_schemas':len(schemas),'schema_examples_checked':['Event','BatchReceipt','ReportSnapshot']},indent=2)+'\n')
print('OpenAPI 3.1,',len(calls),'operations and',len(schemas),'schemas validated.')
