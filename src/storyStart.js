// Hero select's "is everyone ready?" rules, pure so they can be tested. main.js uses them to start a story run, and to
// spot the key or tap that is about to ready the last hero: the opener movie has to start inside that press's handler.

/** True when somebody has joined and everyone who has is ready. */
export function partyReady(slots) {
  const joined = slots.filter(Boolean);
  return joined.length > 0 && joined.every((s) => s.ready);
}

/** The slot this press would ready to complete the party: the only one not ready, if the press is its own. Else -1. */
export function completingSlot(slots, isMine) {
  const waiting = slots.map((s, i) => (s && !s.ready ? i : -1)).filter((i) => i >= 0);
  return waiting.length === 1 && isMine(slots[waiting[0]], waiting[0]) ? waiting[0] : -1;
}
