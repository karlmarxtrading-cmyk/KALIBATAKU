from pathlib import Path
import hashlib,json,sys,collections

if len(sys.argv)!=2:raise SystemExit('Usage: python verify-occurrences.py SOURCE_ROOT')
root=Path(sys.argv[1]).resolve();out=Path(__file__).resolve().parent
route=json.loads((root/'src/journey/v1/route.json').read_text())
errors=[];placements=0;packages=0;prefixes={};tag_pools={};bands=collections.Counter()
byid={n['competency_id']:n for n in route['nodes']}
order={cid:i for i,cid in enumerate(route['order'])}
edges=[]
for node in route['nodes']:
 cid=node['competency_id']
 for pre in node['prerequisites']:
  edges.append([pre,cid])
  if pre not in byid or not byid[pre]['active'] or order[pre]>=order[cid]:errors.append(['prerequisite',pre,cid])
 if not node['active']:
  if node.get('occ'):errors.append(['inactive_has_occ',cid])
  continue
 shpath=root/'src'/node['occ']['url'];raw=shpath.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=node['occ']['sha256'] or len(raw)!=node['occ']['bytes']:errors.append(['shard_digest',cid])
 sh=json.loads(raw)
 g,l=node['grade'],node['level']
 level=json.loads((root/f'dist/bank/g{g:02d}/l{l:02d}.json').read_text())
 cell=next(c for c in level['competencies'] if c['competency_id']==cid)
 catalog={p['package_id']:p for p in cell['packages']};pool=collections.defaultdict(collections.Counter)
 if set(catalog)!={p['package_id'] for p in sh['packages']}:errors.append(['package_set',cid])
 for p in sh['packages']:
  packages+=1;ref=catalog[p['package_id']];data=(root/'dist'/ref['url']).read_bytes()
  if hashlib.sha256(data).hexdigest()!=p['package_sha256'] or p['package_sha256']!=ref['sha256']:errors.append(['package_digest',p['package_id']])
  txt=data.decode();pkg=json.loads(txt[len('export default '):].strip().removesuffix(';'))
  qs=pkg['questions']
  if sorted(q[0] for q in p['q'])!=list(range(len(qs))):errors.append(['occurrence_indexes',p['package_id']])
  if p['content_version']!=pkg['content_version'] or pkg['package_id']!=p['package_id']:errors.append(['package_identity',p['package_id']])
  for row in p['q']:
   placements+=1;q=qs[row[0]];fp=q['fingerprint'];bands[row[2]]+=1
   if row[1]!=fp[:16] or row[7]!='+'.join(q.get('strategy_tags') or []) or row[9]!=q['template_id'] or q['competency_id']!=cid:errors.append(['occurrence_identity',p['package_id'],row[0]])
   if row[2] not in (1,2,3) or not set(row[4])<=set('wta') or len(row[5])!=16:errors.append(['metadata_shape',p['package_id'],row[0]])
   if fp[:16] in prefixes and prefixes[fp[:16]]!=fp:errors.append(['fingerprint16_collision',fp[:16]])
   prefixes[fp[:16]]=fp
   for t in q.get('strategy_tags') or []:pool[p['use']][t]+=1
 tag_pools[cid]=dict(pool)
active_nodes=[n for n in route['nodes'] if n['active']]
unreachable=[]
for n in active_nodes:
 pools=tag_pools[n['competency_id']]
 accessible=set().union(*(set(pools.get(u,{})) for u in ('mission_intro','mission_core','mission_apply')))
 needed=min(route['mission_policy']['readiness']['strategy_min'],len(n['teaching_strategies']))
 if len(accessible)<needed:unreachable.append({'node':n['competency_id'],'required_count':needed,'reachable_before_ready':sorted(accessible),'teaching_strategies':n['teaching_strategies'],'source_strategy_counts':pools})
result={'method':'Independent row-by-row comparison of every sidecar occurrence against the immutable public bank, plus graph and reachable strategy pool checks. No browser or human pedagogical validation claim.','active_nodes':len(active_nodes),'inactive_nodes':len(route['nodes'])-len(active_nodes),'packages':packages,'placements':placements,'prerequisite_edges':len(edges),'fingerprint16_collision_count':sum(e[0]=='fingerprint16_collision' for e in errors),'identity_hash_shape_errors':errors,'band_placements':dict(bands),'unreachable_strategy_nodes':unreachable}
(out/'occurrence-verification.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
print(json.dumps(result,indent=2,ensure_ascii=False))
