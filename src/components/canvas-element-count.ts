interface ElementCountLike {
  isDeleted?: unknown;
}

export function getVisibleElementCount(elements: readonly ElementCountLike[]): number {
  return elements.filter((element) => !element.isDeleted).length;
}

export function createElementCountNotifier(
  notify?: (count: number) => void,
  initialCount = -1
): (count: number) => void {
  let lastCount = initialCount;
  return (count: number) => {
    if (count === lastCount) return;
    lastCount = count;
    notify?.(count);
  };
}
