export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SECRET_KEY: string;
  /** 可选：设置后首次初始化必须携带同样的值 */
  SETUP_TOKEN?: string;
}

export interface ReminderRow {
  id: string;
  title: string;
  note: string;
  due_date: string;
  is_public: number;
  is_done: number;
  done_at: string | null;
  done_by: string | null;
  notify_mode: 'global' | 'off' | 'custom';
  notify_offsets: string | null;
  created_at: string;
  updated_at: string;
}

export interface ColorRule {
  id: string;
  min: number;
  max: number;
  color: string;
  label: string;
}

export interface Settings {
  tz: string;
  lang: 'zh-CN' | 'zh-TW' | 'en' | 'auto';
  notifyLang: 'zh-CN' | 'zh-TW' | 'en';
  colors: {
    overdue: string;
    default: string;
    rules: ColorRule[];
  };
  notify: {
    enabled: boolean;
    time: string;
    offsets: number[];
    digest: { enabled: boolean; windowDays: number };
    bark: {
      enabled: boolean;
      baseUrl: string;
      keyCipher: string;
      group: string;
      sound: string;
      level: 'active' | 'timeSensitive' | 'passive' | 'critical';
      icon: string;
    };
  };
  display: {
    darkMode: 'auto' | 'light' | 'dark';
  };
}
