import { useSyncExternalStore } from "react";
import { useReducedMotion as useFramerReducedMotion } from "framer-motion";

/**
 * Like framer-motion's hook, but false on the server and during hydration. The server cannot know
 * the visitor's motion setting, so first paint always matches; reduced-motion visitors get a
 * hydration mismatch otherwise.
 */
export function useReducedMotion(): boolean {
  const setting = useFramerReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return mounted && !!setting;
}
