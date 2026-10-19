/**
 * Forge OS — Pay Run lifecycle state machine.
 * Enforced in the DB by PATCH_89 trigger enforce_pay_run_transition();
 * this is the client/edge-function mirror for UI gating and validation.
 */

export const PAY_RUN_STATES = [
  'draft', 'calculating', 'calculated', 'in_review', 'approved',
  'finalized', 'payment_file_generated', 'paid', 'archived', 'cancelled',
] as const;
export type PayRunState = (typeof PAY_RUN_STATES)[number];

export const PAY_RUN_TRANSITIONS: Record<PayRunState, PayRunState[]> = {
  draft: ['calculating', 'cancelled'],
  calculating: ['calculated', 'draft'],          // calc failure returns to draft
  calculated: ['in_review', 'draft'],            // AI check layer runs here
  in_review: ['approved', 'draft'],
  approved: ['finalized', 'draft'],              // reopen only from draft-ish states
  finalized: ['payment_file_generated'],
  payment_file_generated: ['paid'],
  paid: ['archived'],
  archived: [],
  cancelled: [],                                 // terminal; fix via adjustment run
};

export function canTransition(from: PayRunState, to: PayRunState): boolean {
  return PAY_RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: PayRunState, to: PayRunState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal pay run transition: ${from} -> ${to}`);
  }
}

/** States where pay_run_items are still mutable (recalculation allowed). */
export const MUTABLE_ITEM_STATES: PayRunState[] = ['draft', 'calculating'];

/** An adjustment run points at the archived run it corrects. */
export interface AdjustmentLink {
  adjustmentOfRunId: string;
  reason: string;
}
