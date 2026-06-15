interface ConsumeWebSearchRequirementArgs {
  enabled: boolean;
  turnId: string;
  searchedTurnIds: Set<string>;
  maxTrackedTurns?: number;
}

export function consumeWebSearchRequirement({
  enabled,
  turnId,
  searchedTurnIds,
  maxTrackedTurns = 100,
}: ConsumeWebSearchRequirementArgs): boolean {
  if (!enabled) return false;
  if (searchedTurnIds.has(turnId)) return false;

  searchedTurnIds.add(turnId);
  while (searchedTurnIds.size > maxTrackedTurns) {
    const first = searchedTurnIds.values().next().value;
    if (typeof first !== "string") break;
    searchedTurnIds.delete(first);
  }

  return true;
}
