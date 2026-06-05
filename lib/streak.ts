import { currentReadingDate, shiftDate } from "./dates";

/**
 * 인증 날짜 집합에서 오늘부터 거꾸로 이어지는 연속 인증 일수.
 * 오늘 아직 인증 전이어도 어제까지 이어진 스트릭은 유지한다(끊긴 게 아님).
 */
export function currentStreak(
  dates: Iterable<string>,
  today: string = currentReadingDate()
): number {
  const set = dates instanceof Set ? dates : new Set(dates);
  let cursor = set.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}
