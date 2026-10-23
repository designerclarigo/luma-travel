// Retain the existing key/value so prior installations keep their progress.
export const onboardingStorageKey = '@waylo/onboarding-complete';

type ProgressStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export async function readOnboarding(storage: ProgressStorage) {
  return (await storage.getItem(onboardingStorageKey)) === 'complete';
}

/** Coalesce rapid presses; navigate only after the durable write succeeds. */
export function createOnboardingCompletion(storage: ProgressStorage, navigate: () => void) {
  let pending: Promise<void> | undefined;
  return () => {
    if (!pending) {
      pending = storage.setItem(onboardingStorageKey, 'complete').then(navigate).catch((error) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}

export function pageFromOffset(offset: number, width: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.round(offset / Math.max(1, width))));
}
