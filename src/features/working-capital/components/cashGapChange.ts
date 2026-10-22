export function gapChange(before: number, after: number) {
  const difference = before - after;
  return {
    kind: difference > 0 ? "improved" : difference < 0 ? "worsened" : "unchanged",
    days: Math.abs(difference),
  } as const;
}
