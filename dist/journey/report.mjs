// The teacher view uses the same route, teaching pools and passing rules as the map.
// 'history' is already scoped to one learner, origin, module and completion cutoff.
import route from './v1/route.json' with {type:'json'};
import {journeyState} from './model.mjs';

export function journeySummary(history, {period=history, filters={}, asOf=null}={}) {
  const state=journeyState(route,history);
  const periodIds=new Set(period.map(a=>a.attempt_id));
  const threshold=route.mission_policy.readiness;
  const rows=[];
  for(const s of state.nodes.values()){
    const node=s.node;
    if(!s.missions.length&&!s.coverage)continue;
    if(['grade','level','operation'].some(k=>filters[k]&&String(filters[k])!==String(node[k])))continue;
    const periodMissions=s.missions.filter(o=>periodIds.has(o.attempt_id));
    const sum=k=>periodMissions.reduce((total,o)=>total+o[k],0);
    rows.push({node_id:s.id,grade:node.grade,level:node.level,operation:node.operation,
      missions:periodMissions.length,first_independent:sum('first_independent'),first_total:sum('first_total'),
      assisted:sum('assisted'),revised_after_key:sum('revised_after_key'),xp:5*periodMissions.length+10*sum('first_independent'),
      cumulative_missions:s.missions.length,passing_missions:s.passing.size,unique_seen:s.coverage,
      strategies_seen:s.strategies_seen,ready:s.ready,rule:{target_missions:s.rule.target_missions,
        min_rate:s.rule.min_rate,coverage_needed:s.coverage_needed,
        strategies_needed:s.strategies_needed,label:threshold.label}});
  }
  return {policy:state.policy,exposure_policy:state.exposure_policy,readiness_registry:state.registry_version,mission_policy:route.mission_policy.policy_version,as_of:asOf,
    readiness_scope:'cumulative_completed_as_of_current_policy',activity_scope:'selected_sessions_started_in_period_completed_by_cutoff',
    rows,missions:rows.reduce((s,r)=>s+r.missions,0),xp:rows.reduce((s,r)=>s+r.xp,0),
    readiness_label:'product_policy_not_psychometric',xp_label:'effort_marker_not_academic'};
}
