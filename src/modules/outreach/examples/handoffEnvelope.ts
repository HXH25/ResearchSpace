import type { EvidenceSource, StudentProfile } from '@/sdk/contracts';
import { parseHandoff } from '../core/handoff';
import { fail } from '../core/safety';

/** The producer must pass the snapshot time ACTUALLY used for qualification.
 * Never bind an old numeric profileVersion to a new updatedAt by assumption. */
export function createHandoffEnvelope(args:{
  legacyHandoff:unknown; opportunityId:string; sources:EvidenceSource[];
  assessedHostProfileUpdatedAt:string; currentProfile:StudentProfile;
}) {
  if(args.assessedHostProfileUpdatedAt!==args.currentProfile.updatedAt) fail('HANDOFF_STALE','资格评估使用的画像已变化，请重新评估。');
  const result={kind:'researchspace-outreach-handoff/1' as const,profileUpdatedAt:args.assessedHostProfileUpdatedAt,opportunityId:args.opportunityId,sources:args.sources,handoff:args.legacyHandoff};
  parseHandoff(result,args.currentProfile);
  return result;
}
