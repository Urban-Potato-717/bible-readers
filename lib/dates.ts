// KST(UTC+9) 기준 날짜 헬퍼.
// 벌금 컷오프가 새벽 1시이므로, "오늘"은 KST 01:00 이후부터 그날 24:00까지로 본다.
// 즉 KST 00:00 ~ 01:00 사이 인증은 전날 분으로 친다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const CUTOFF_HOUR_KST = 1; // 새벽 1시

export function kstNow(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

/** 컷오프 보정된 "현재 인증 대상일" (YYYY-MM-DD, KST) */
export function currentReadingDate(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  // 컷오프 시각 이전이면 전날로
  if (kst.getUTCHours() < CUTOFF_HOUR_KST) {
    kst.setUTCDate(kst.getUTCDate() - 1);
  }
  return kst.toISOString().slice(0, 10);
}

/** 어제 (KST). 새벽 1시 cron이 어제 미인증자 벌금 부과할 때 사용 */
export function yesterdayKst(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  kst.setUTCDate(kst.getUTCDate() - 1);
  return kst.toISOString().slice(0, 10);
}

export function formatKoreanDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}
