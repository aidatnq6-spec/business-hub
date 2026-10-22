// A serialized, copy-on-write transaction fake; no production Firebase is contacted.
export function fakeFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  let tail = Promise.resolve();
  const snap = (path: string) => ({
    id: path.split('/').at(-1),
    exists: docs.has(path),
    data: () => structuredClone(docs.get(path)),
  });
  const ref = (path: string) => ({
    path,
    id: path.split('/').at(-1),
    get: async () => snap(path),
    set: async (value: Record<string, unknown>) => {
      docs.set(path, structuredClone(value));
    },
    create: async (value: Record<string, unknown>) => {
      if (docs.has(path)) throw new Error('already exists');
      docs.set(path, structuredClone(value));
    },
    update: async (value: Record<string, unknown>) => {
      if (!docs.has(path)) throw new Error('missing');
      docs.set(path, { ...docs.get(path), ...structuredClone(value) });
    },
    collection: (name: string) => col(path + '/' + name),
  });
  const col = (path: string) => {
    let max = 100,
      filter: ((v: Record<string, unknown>) => boolean) | null = null;
    const query = {
      doc: (id: string) => ref(path + '/' + id),
      orderBy: () => query,
      limit: (n: number) => {
        max = n;
        return query;
      },
      where: (field: string, _op: string, value: unknown) => {
        filter = (v) => v[field] === value;
        return query;
      },
      get: async () => {
        const matching = [...docs.entries()]
          .filter(
            ([p, v]) =>
              p.startsWith(path + '/') &&
              p.split('/').length === path.split('/').length + 1 &&
              (!filter || filter(v)),
          )
          .slice(0, max)
          .map(([p]) => ({ ...snap(p), ref: ref(p) }));
        return { docs: matching, size: matching.length, empty: matching.length === 0 };
      },
    };
    return query;
  };
  const db = {
    collection: col,
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
      const previous = tail;
      let release = () => {};
      tail = new Promise<void>((r) => {
        release = r;
      });
      await previous;
      const writes: (() => void)[] = [];
      const tx = {
        get: async (r: { path: string }) => snap(r.path),
        set: (r: { path: string }, v: Record<string, unknown>) =>
          writes.push(() => docs.set(r.path, structuredClone(v))),
        create: (r: { path: string }, v: Record<string, unknown>) => {
          if (docs.has(r.path)) throw new Error('already exists');
          writes.push(() => docs.set(r.path, structuredClone(v)));
        },
        update: (r: { path: string }, v: Record<string, unknown>) =>
          writes.push(() => {
            docs.set(r.path, { ...docs.get(r.path), ...structuredClone(v) });
          }),
      };
      try {
        const result = await fn(tx);
        writes.forEach((w) => w());
        return result;
      } finally {
        release();
      }
    },
  };
  return { db, docs };
}
