export type Lang = 'zh-CN' | 'zh-TW' | 'en';

interface Dict {
  dayToday: string;
  dayLeft: (n: number) => string;
  dayOverdue: (n: number) => string;
  digestTitle: (count: number) => string;
  singleTitle: (title: string, days: string) => string;
  moreItems: (count: number) => string;
  testTitle: string;
  testBody: string;
}

const dicts: Record<Lang, Dict> = {
  'zh-CN': {
    dayToday: '今天到期',
    dayLeft: (n) => `还剩 ${n} 天`,
    dayOverdue: (n) => `已过期 ${n} 天`,
    digestTitle: (count) => `今日日期提醒 (${count})`,
    singleTitle: (title, days) => `${title} · ${days}`,
    moreItems: (count) => `…等共 ${count} 条`,
    testTitle: '日期提醒 测试推送',
    testBody: '如果你收到这条消息，说明 Bark 配置正确。',
  },
  'zh-TW': {
    dayToday: '今天到期',
    dayLeft: (n) => `還剩 ${n} 天`,
    dayOverdue: (n) => `已過期 ${n} 天`,
    digestTitle: (count) => `今日日期提醒 (${count})`,
    singleTitle: (title, days) => `${title} · ${days}`,
    moreItems: (count) => `…等共 ${count} 條`,
    testTitle: '日期提醒 測試推送',
    testBody: '如果你收到這則訊息，代表 Bark 設定正確。',
  },
  en: {
    dayToday: 'due today',
    dayLeft: (n) => `${n} day${n === 1 ? '' : 's'} left`,
    dayOverdue: (n) => `${n} day${n === 1 ? '' : 's'} overdue`,
    digestTitle: (count) => `Upcoming reminders (${count})`,
    singleTitle: (title, days) => `${title} · ${days}`,
    moreItems: (count) => `…and ${count} more`,
    testTitle: 'Date Alert test push',
    testBody: 'If you received this, your Bark configuration works.',
  },
};

const MAX_LINES = 10;

export function dayText(lang: Lang, daysLeft: number): string {
  const dict = dicts[lang] ?? dicts['zh-CN'];
  if (daysLeft === 0) return dict.dayToday;
  if (daysLeft < 0) return dict.dayOverdue(Math.abs(daysLeft));
  return dict.dayLeft(daysLeft);
}

export interface PushItem {
  title: string;
  daysLeft: number;
}

export interface PushMessage {
  title: string;
  body: string;
}

export function buildPushMessage(lang: Lang, items: PushItem[]): PushMessage {
  const dict = dicts[lang] ?? dicts['zh-CN'];
  const sorted = [...items].sort((a, b) => a.daysLeft - b.daysLeft);

  if (sorted.length === 1) {
    const item = sorted[0];
    return { title: dict.singleTitle(item.title, dayText(lang, item.daysLeft)), body: '' };
  }

  const shown = sorted.slice(0, MAX_LINES);
  const lines = shown.map((item) => `• ${item.title} · ${dayText(lang, item.daysLeft)}`);
  if (sorted.length > MAX_LINES) lines.push(dict.moreItems(sorted.length));

  return { title: dict.digestTitle(sorted.length), body: lines.join('\n') };
}

export function testMessage(lang: Lang): PushMessage {
  const dict = dicts[lang] ?? dicts['zh-CN'];
  return { title: dict.testTitle, body: dict.testBody };
}
