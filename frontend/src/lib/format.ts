export function formatLockerNumber(number: number) {
  return `L-${String(number).padStart(2, '0')}`;
}
