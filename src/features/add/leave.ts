/**
 * What Back does in Add books (E8, F2). Used for the header back button, Android hardware Back
 * and the back gesture alike (QA-ANDROID bug 3).
 */

export type AddStepKind = 'pick' | 'work' | 'confirm' | 'done';

export type LeaveDecision =
  /** Go back one step inside Add books (Review → the scan queue / search / typed book). */
  | { kind: 'stepBack' }
  /** Ask first: there is unsaved work. */
  | { kind: 'confirm'; queued: number; typed: boolean }
  /** Nothing to lose: close Add books. */
  | { kind: 'leave' };

export function leaveDecision(state: {
  step: AddStepKind;
  /** Where the confirm step came from; 'work' ("I own this") has no earlier step. */
  confirmOrigin?: string;
  /** Books in the scan queue (scanned but not added). */
  queued: number;
  /** "Type it in" has unsaved text. */
  typed: boolean;
}): LeaveDecision {
  if (state.step === 'confirm' && state.confirmOrigin !== 'work') return { kind: 'stepBack' };
  if (state.step === 'pick' && (state.queued > 0 || state.typed)) {
    return { kind: 'confirm', queued: state.queued, typed: state.typed };
  }
  return { kind: 'leave' };
}

/** Copy for the discard confirm. */
export function discardCopy(
  queued: number,
  typed: boolean
): { title: string; body: string; keep: string } {
  if (queued > 0) {
    const books = queued === 1 ? '1 scanned book' : `${queued} scanned books`;
    return {
      title: `Discard ${books}?`,
      body: typed
        ? 'They haven’t been added yet, and what you typed won’t be saved.'
        : 'They haven’t been added to your books yet.',
      keep: 'Keep scanning',
    };
  }
  return {
    title: 'Discard this book?',
    body: 'What you typed won’t be saved.',
    keep: 'Keep editing',
  };
}
