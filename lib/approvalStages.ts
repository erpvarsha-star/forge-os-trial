// Shared with components/LeaveAdvanceApprovalCards.tsx (approver side) and
// LeaveScreen/AdvanceScreen (requester side) so both show the same stage
// names for a request's approval_chain — see PATCH_53.
export const STAGE_LABELS: Record<string, string> = {
  manager: 'Manager',
  hr_admin: 'HR',
  accounts: 'Accounts',
  plant_head: 'Plant Head',
  owner: 'Owner',
}

export function stageProgressLabel(currentStage: number, approvalChain: string[] | null | undefined): string | null {
  if (!approvalChain || approvalChain.length === 0) return null
  if (currentStage >= approvalChain.length) return null
  const role = approvalChain[currentStage]
  return `Awaiting ${STAGE_LABELS[role] || role} (${currentStage + 1}/${approvalChain.length})`
}
