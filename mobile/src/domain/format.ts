// 날짜·시간 표시. 기기 시간대 기준. Intl 지원 차이를 피하려고 직접 만든다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 카드용 짧은 형식. 예: "10.4 (토) 18:30" */
export function formatShortDateTime(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()} (${WEEKDAYS[d.getDay()]}) ${formatTime(d)}`;
}

/** 날짜 칩용. 예: "10.4 (토)" */
export function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

/** 상세 화면용. 같은 날이면 "10월 4일 (토) 18:30 ~ 21:00" */
export function formatRange(start: Date, end: Date): string {
  const head = `${start.getMonth() + 1}월 ${start.getDate()}일 (${WEEKDAYS[start.getDay()]}) ${formatTime(start)}`;
  if (sameDay(start, end)) return `${head} ~ ${formatTime(end)}`;
  return `${head} ~ ${end.getMonth() + 1}월 ${end.getDate()}일 ${formatTime(end)}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function relativeTime(d: Date, now: Date): string {
  const diff = Math.max(0, now.getTime() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return formatShortDate(d);
}

/** 주말(토·일) 여부. 모임 탐색의 "이번 주말" 필터에 쓴다 */
export function isThisWeekend(d: Date, now: Date): boolean {
  const day = now.getDay();
  // 이번 주 토요일 0시 (일요일이면 어제 토요일)
  const saturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (day === 0 ? -1 : 6 - day));
  const mondayAfter = new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate() + 2);
  return d >= saturday && d < mondayAfter;
}

export function formatWon(amount: number): string {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}
