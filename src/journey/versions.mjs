// Compatible journey snapshot tuples. Both releases use bank 1.2.0 and occurrence schema 1.
import {EXPOSURE_POLICY} from './exposure.mjs';
export function supportsJourneyVersion(journey) {
  if (!journey || journey.journey_id !== 'kalibataku-adventure' || journey.metadata_version !== '1.0.0' ||
      (journey.exposure_policy !== undefined && journey.exposure_policy !== EXPOSURE_POLICY)) return false;
  for (const version of ['1.0.0', '1.1.0']) {
    if (journey.route_version === 'route-' + version &&
        journey.policy_version === 'mission-policy-' + version &&
        journey.selection_trace?.selector_version === 'selector-' + version &&
        (journey.journey_policy === undefined || journey.journey_policy === 'journey-policy-' + version) &&
        (journey.feature_policy === undefined || journey.feature_policy === 'difficulty-heuristic-1.0.0')) return true;
  }
  return false;
}
