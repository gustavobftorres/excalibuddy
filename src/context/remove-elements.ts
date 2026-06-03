interface BoundElementRef {
  id?: unknown;
}

interface ElementLike {
  id?: unknown;
  containerId?: unknown;
  boundElements?: BoundElementRef[] | null;
}

function getId(element: ElementLike): string | null {
  return typeof element.id === "string" ? element.id : null;
}

function getBoundIds(element: ElementLike): string[] {
  if (!Array.isArray(element.boundElements)) return [];
  return element.boundElements
    .map((bound) => (typeof bound?.id === "string" ? bound.id : null))
    .filter((id): id is string => id !== null);
}

export function cascadeRemoveElements<T extends ElementLike>(elements: T[], ids: string[]): T[] {
  const remove = new Set(ids);
  const byId = new Map<string, T>();

  for (const element of elements) {
    const id = getId(element);
    if (id) byId.set(id, element);
  }

  const queue = [...remove];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = byId.get(currentId);

    if (current) {
      for (const boundId of getBoundIds(current)) {
        if (!remove.has(boundId)) {
          remove.add(boundId);
          queue.push(boundId);
        }
      }
    }

    for (const element of elements) {
      const id = getId(element);
      if (!id || remove.has(id)) continue;
      if (element.containerId === currentId) {
        remove.add(id);
        queue.push(id);
      }
    }
  }

  return elements.filter((element) => {
    const id = getId(element);
    return !id || !remove.has(id);
  });
}
