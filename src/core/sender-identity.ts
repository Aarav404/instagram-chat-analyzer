import type { AnalysisRequest } from './types'

export function combinesGroupAccounts(request: AnalysisRequest): boolean {
  return !!request.groupName && request.settings.ownerNames.length > 0
}

/** Custom groups combine alternate accounts; source messages remain unchanged. */
export function senderIdentity(sender: string, request: AnalysisRequest): string {
  if (!combinesGroupAccounts(request)) return sender
  if (request.settings.ownerNames.includes(sender)) return 'You'
  return request.groupName === 'You' ? 'Other person' : request.groupName!
}
