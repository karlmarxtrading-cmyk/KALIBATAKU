// A derived observation. Restoring or recomputing coverage never mutates a snapshot.
export const EXPOSURE_POLICY='viewed-items-1.0.0';

export function itemWasViewed(item){
  if(item.final_status==='unseen')return false;
  if(Object.hasOwn(item,'seen'))return item.seen===true;
  // Older records may lack the flag. An index, status label, draft or package
  // assignment alone does not establish that this particular item was displayed.
  return !!item.history?.length ||
    (typeof item.first_seen_at==='string'&&Number.isFinite(Date.parse(item.first_seen_at)));
}
