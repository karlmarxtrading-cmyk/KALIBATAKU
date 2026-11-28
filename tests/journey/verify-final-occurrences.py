from pathlib import Path
import hashlib,json,sys,collections

root=Path(__file__).resolve().parents[2];out=root/'evidence/v15/release'
route=json.loads((root/'dist/journey/v1/route.json').read_text())
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
 shpath=root/'dist'/node['occ']['url'];raw=shpath.read_bytes()
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
result={'method':'Independent position, identity, strategy, hash, catalog and graph comparison on the packaged dist.', 'active_nodes':len(active_nodes),'inactive_nodes':len(route['nodes'])-len(active_nodes),'packages':packages,'placements':placements,'prerequisite_edges':len(edges),'unique_fingerprints':len(prefixes),'identity_hash_shape_errors':errors,'band_placements':dict(bands),'offline_release':json.loads((root/'dist/offline-assets.json').read_bytes())['release']}
assert not errors and (len(active_nodes),len(route['nodes']),packages,placements,len(edges)) == (281,300,4604,177640,712),result
out.mkdir(exist_ok=True,parents=True)
(out/'occurrence-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS 177640 occurrences, 4604 verified packages and 712 active prerequisite edges')
