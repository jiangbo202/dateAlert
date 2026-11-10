export interface LocalTime {
  date: string;
  hh: number;
  mm: number;
}

/** 指定时区的"今天"，格式 YYYY-MM-DD */
export function todayInTz(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
}

/** 指定时区的本地时间 */
export function localTime(tz: string, now: Date = new Date()): LocalTime {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    // hour12:false 在部分实现下会返回 "24"
    hh: Number(get('hour')) % 24,
    mm: Number(get('minute')),
  };
}

/** 是否设置了到期日（无日期提醒的 due_date 为空字符串） */
export function hasDueDate(dueDate: string | null | undefined): boolean {
  return typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
}

/** 剩余天数：正数未到期，0 当天到期，负数已过期 */
export function daysLeft(dueDate: string, today: string): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.round((due - now) / 86_400_000);
}

/** "HH:MM" -> 分钟数 */
export function minutesOfDay(time: string): number {
  const [hh = '0', mm = '0'] = time.split(':');
  return Number(hh) * 60 + Number(mm);
}

/** 日期字符串加减天数 */
export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
