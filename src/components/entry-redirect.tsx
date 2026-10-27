import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';

/** One navigation action per destination, including while Router reports state updates. */
export function EntryRedirect({ href }: { href: Href }) {
  const destination = JSON.stringify(href);
  const dispatched = useRef<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (dispatched.current === destination) return;
    dispatched.current = destination;
    router.replace(JSON.parse(destination) as Href);
  }, [destination]));
  return null;
}
