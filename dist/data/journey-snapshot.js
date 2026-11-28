import {canonical, invariant, sha256, SAFE_ID} from './common.js';
import {supportsJourneyVersion} from '../journey/versions.mjs';
import {levelHashes, nodeContracts, packageLayouts} from './journey-bank-index.js';

const assert = value => invariant(value, 'INVALID_BACKUP_JOURNEY');
const operations = {ADD:'addition', SUB:'subtraction', MUL:'multiplication', DIV:'division', MIX:'mixed'};
const kinds = {
  intro:['introduce','consolidate'], regular:['consolidate','transfer','introduce'],
  reinforcement:['introduce','consolidate'], checkpoint:['review','transfer','consolidate'],
  review:['review','consolidate','transfer','introduce']
};
const useFor = {introduce:'mission_intro', consolidate:'mission_core', transfer:'mission_apply', review:'mission_review'};
const root = new URL('../', import.meta.url);
const hexDigest = /^[a-f0-9]{64}$/;
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const pad = value => String(value).padStart(2,'0');

// Each reader owns a small cache. It examines installed bytes only, without starting downloads.
export function createJourneySourceReader() {
  const cache = new Map();
  return async (path, digest, module = false) => {
    if (!globalThis.caches) return null;
    const key = path + '#' + digest;
    if (cache.has(key)) return cache.get(key);
    const url = new URL(path, root);
    let bytes = null, found = false;
    try {
      const first = await globalThis.caches.match(url.href);
      if (first) {
        found = true;
        const candidate = await first.arrayBuffer();
        if (await sha256(candidate) === digest) bytes = candidate;
        // Old and new shell/pack caches can coexist while another tab is open.
        // Catalogue and occurrence URLs are shared across historical releases.
        else {
          for (const name of await globalThis.caches.keys()) {
            const other = await globalThis.caches.match(url.href,{cacheName:name});
            if (!other) continue;
            const alternative = await other.arrayBuffer();
            if (await sha256(alternative) === digest) {bytes = alternative;break;}
          }
        }
      }
    } catch (error) {
      if (['SecurityError','InvalidStateError'].includes(error.name)) return null;
      throw error;
    }
    let value = null;
    // Package URLs include bank version, so a corrupt cached body at that exact
    // versioned path is distinct from a historical catalogue at a reused URL.
    if (module && found) invariant(bytes, 'BACKUP_JOURNEY_SOURCE_DAMAGED');
    if (bytes) {
      const source = new TextDecoder('utf-8',{fatal:true}).decode(bytes).trimEnd();
      if (module) assert(source.startsWith('export default ') && source.endsWith(';'));
      value = JSON.parse(module ? source.slice('export default '.length,-1) : source);
    }
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(key,value);
    return value;
  };
}

export async function validateJourneySnapshot(a, read = createJourneySourceReader()) {
  const j = a.journey;
  invariant(supportsJourneyVersion(j), 'UNSUPPORTED_BACKUP_JOURNEY');
  const grade = pad(a.grade), level = pad(a.level), stage = 'G' + grade + '-L' + level;
  const nodeId = 'arithmetic.' + operations[a.operation] + '.g' + grade + '.l' + level;
  const node = nodeContracts[nodeId], refs = j.selected_occurrence_refs;
  assert(node && a.mode === 'practice' && a.form_id === null && a.content_version === '1.2.0' &&
    a.target_competency_id === nodeId && j.node_id === nodeId && j.stage_id === 'S-' + stage &&
    Object.hasOwn(kinds,j.mission_kind) && integer(j.seed,0,0xffffffff) && a.order_seed === String(j.seed));
  if (Object.hasOwn(j,'start_intent_id') || Object.hasOwn(j,'start_intent_step')) {
    assert(typeof j.start_intent_id === 'string' && SAFE_ID.test(j.start_intent_id) && integer(j.start_intent_step,1,Number.MAX_SAFE_INTEGER));
  }
  const rule = j.readiness_rule;
  assert(rule?.target_missions === 2 && rule.min_rate === 0.8 && rule.label === 'product_policy_not_psychometric' &&
    rule.coverage_needed === node.coverage && rule.strategies_needed === node.strategies);
  assert(Array.isArray(refs) && refs.length === a.items.length && refs.length > 0);
  const prefix = 'MM-' + stage + '-' + a.operation + '-P';
  const contractFor = id => {
    assert(typeof id === 'string' && id.startsWith(prefix) && /^\d{3}$/.test(id.slice(prefix.length)));
    const entry = packageLayouts[node.layout][Number(id.slice(prefix.length))-1];
    assert(entry && Object.hasOwn(useFor,entry[0]));
    return entry;
  };
  const [purpose,count] = contractFor(a.package_id);
  const t = j.selection_trace;
  assert(t.kind === j.mission_kind && t.policy_version === j.policy_version && t.seed === j.seed &&
    t.chosen === a.package_id && t.size === refs.length && Array.isArray(t.reasons) && t.reasons.every(r=>typeof r === 'string') &&
    typeof t.offline_filter === 'boolean' && Array.isArray(t.candidates) && integer(t.candidate_count,1,packageLayouts[node.layout].length) &&
    t.candidates.length === Math.min(t.candidate_count,8) && t.candidates[0]?.package_id === a.package_id &&
    new Set(t.candidates.map(c=>c?.package_id)).size === t.candidates.length);
  const fallback = j.route_version === 'route-1.1.0' && ['regular','reinforcement'].includes(j.mission_kind) &&
    t.reasons.includes('teaching_purpose_fallback_for_readiness') && t.reasons.some(r=>['missing_strategy','missing_coverage'].includes(r));
  assert(kinds[j.mission_kind].includes(purpose) || fallback);
  for (const candidate of t.candidates) {
    const [candidatePurpose,candidateCount] = contractFor(candidate.package_id);
    assert(candidate.use === useFor[candidatePurpose] && integer(candidate.unique,1,candidateCount) &&
      integer(candidate.unseen,0,candidate.unique));
  }
  const maxItems = j.mission_kind === 'intro' ? 6 : j.mission_kind === 'checkpoint' ? 10 : 8;
  assert(a.items.length <= maxItems && (a.items.length === maxItems || t.reasons.includes('package_smaller_than_mission')));
  const indices = new Set(), fingerprints = new Set();
  let reviewCount = 0, previousRole = -1;
  const digest = refs[0]?.package_sha256;
  assert(typeof digest === 'string' && hexDigest.test(digest));
  for (const [index,item] of a.items.entries()) {
    const q = item.question, ref = item.occurrence_ref, role = ['w','t','a'].indexOf(item.journey_role);
    assert(role >= 0 && role >= previousRole && (role !== 2 || j.mission_kind !== 'intro') &&
      integer(item.journey_band,1,3) && typeof item.journey_review === 'boolean' &&
      q.competency_id === nodeId && q.question_id === nodeId + '.' + q.fingerprint &&
      q.question_revision === a.content_version && !fingerprints.has(q.fingerprint));
    assert(ref && ref.package_id === a.package_id && ref.content_version === a.content_version &&
      ref.package_sha256 === digest && integer(ref.question_index,0,count-1) && !indices.has(ref.question_index) &&
      ref.question_id === q.question_id && ref.question_revision === q.question_revision &&
      refs[index] && canonical(ref,false) === canonical(refs[index],false));
    indices.add(ref.question_index);
    fingerprints.add(q.fingerprint);
    previousRole = role;
    if (item.journey_review) reviewCount++;
  }
  assert(t.review === reviewCount && t.unique_new === refs.length - reviewCount);

  // The catalogue, shard and package each have an independent trust anchor outside the archive.
  const levelPath = 'bank/g' + grade + '/l' + level + '.json';
  const catalogue = await read(levelPath,levelHashes[levelPath]);
  const shard = await read('journey/v1/occ/' + nodeId + '.json',node.shardSha256);
  let expectedDigest;
  if (catalogue) {
    const entry = catalogue.competencies.find(n=>n.competency_id === nodeId)?.packages.find(p=>p.package_id === a.package_id);
    assert(entry?.sha256 === digest && entry.content_version === a.content_version);
    expectedDigest = entry.sha256;
  }
  if (shard) {
    const entry = shard.packages.find(p=>p.package_id === a.package_id);
    assert(entry?.package_sha256 === digest && entry.content_version === a.content_version);
    expectedDigest = entry.package_sha256;
    for (const item of a.items) {
      const row = entry.q[item.occurrence_ref.question_index], q = item.question;
      assert(row && row[0] === item.occurrence_ref.question_index && row[1] === q.fingerprint.slice(0,16) &&
        row[2] === item.journey_band && (row[4].includes(item.journey_role) ||
          (item.journey_role === 't' && t.reasons.includes('role_quota_filled_from_target'))) &&
        row[7] === q.strategy_tags.join('+') && row[9] === q.template_id);
    }
  }
  const pack = expectedDigest && await read('bank/v1.2/g' + grade + '/l' + level + '/' + a.package_id + '.mjs',expectedDigest,true);
  if (pack) {
    assert(pack.package_id === a.package_id && pack.content_version === a.content_version && pack.form_id === null);
    for (const item of a.items) {
      const original = pack.questions[item.occurrence_ref.question_index];
      assert(original && canonical(original,false) === canonical(item.question,false));
    }
    return 'bank_matched';
  }
  return shard ? 'occurrences_matched' : 'internal_only';
}
