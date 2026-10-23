/** A dismissal must be intentional; a fast flick still needs some downward travel. */
export function shouldDismissSheet(distance: number, velocity: number): boolean {
  'worklet';
  return distance >= 96 || distance >= 24 && velocity >= 900;
}

/** Keep seven columns only when each day can retain a 48pt touch target. */
export function calendarColumns(width: number, fontScale: number): 3 | 7 {
  return (Math.min(width, 640) - 48) / 7 < 48 || fontScale > 1.2 ? 3 : 7;
}
