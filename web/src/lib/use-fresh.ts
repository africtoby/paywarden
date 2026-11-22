import { useEffect, useRef, useState } from "react";

/** Keys that showed up after the first load finished. On load nothing is fresh, so lists never animate their history. */
export function freshKeys(before: ReadonlySet<string> | null, now: readonly string[]): string[] {
  if (!before) return [];
  return now.filter((k) => !before.has(k));
}

export function useFreshKeys(keys: readonly string[], loading: boolean, ms = 1500): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const joined = keys.join("|");

  useEffect(() => {
    if (loading) return;
    const added = freshKeys(seen.current, keys);
    seen.current = new Set(keys);
    if (!added.length) return;
    queueMicrotask(() => setFresh((f) => new Set([...f, ...added])));
    const t = setTimeout(() => setFresh((f) => new Set([...f].filter((k) => !added.includes(k)))), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, loading, ms]);

  return fresh;
}
