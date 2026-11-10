import { computed, ref } from 'vue';
import { api, ApiError } from '../api/client';

export interface ColorRuleView {
  id: string;
  min: number;
  max: number;
  color: string;
  label: string;
}

export interface SettingsView {
  tz: string;
  lang: 'auto' | 'zh-CN' | 'zh-TW' | 'en';
  notifyLang: 'zh-CN' | 'zh-TW' | 'en';
  colors: { overdue: string; default: string; rules: ColorRuleView[] };
  notify: {
    enabled: boolean;
    time: string;
    offsets: number[];
    digest: { enabled: boolean; windowDays: number };
    bark: {
      enabled: boolean;
      baseUrl: string;
      group: string;
      sound: string;
      level: string;
      icon: string;
      hasKey?: boolean;
    };
  };
  display: { darkMode: 'auto' | 'light' | 'dark' };
}

const draft = ref<SettingsView | null>(null);
const snapshot = ref('');
const loading = ref(false);
const saving = ref(false);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const issues = ref<Array<{ code: string; field: string; message: string }>>([]);
const newKey = ref('');
const clearKey = ref(false);

const dirty = computed(() => {
  if (!draft.value) return false;
  return JSON.stringify(draft.value) !== snapshot.value || Boolean(newKey.value) || clearKey.value;
});

function normalize(settings: SettingsView): SettingsView {
  return JSON.parse(JSON.stringify(settings)) as SettingsView;
}

async function loadSettings(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const data = await api<SettingsView>('/api/admin/settings');
    draft.value = normalize(data);
    snapshot.value = JSON.stringify(draft.value);
    newKey.value = '';
    clearKey.value = false;
  } catch (err) {
    loadError.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

async function saveSettings(): Promise<boolean> {
  if (!draft.value) return false;
  saving.value = true;
  saveError.value = null;
  issues.value = [];

  const payload = normalize(draft.value) as SettingsView & { notify: { bark: Record<string, unknown> } };
  delete payload.notify.bark.hasKey;
  if (newKey.value) payload.notify.bark.key = newKey.value;
  if (clearKey.value) payload.notify.bark.clearKey = true;

  try {
    const saved = await api<SettingsView>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    draft.value = normalize(saved);
    snapshot.value = JSON.stringify(draft.value);
    newKey.value = '';
    clearKey.value = false;
    return true;
  } catch (err) {
    if (err instanceof ApiError) {
      saveError.value = err.code;
      issues.value = (err.body?.issues as typeof issues.value) ?? [];
    } else {
      saveError.value = 'NETWORK_ERROR';
    }
    return false;
  } finally {
    saving.value = false;
  }
}

function resetDraft(): void {
  if (!draft.value) return;
  draft.value = JSON.parse(snapshot.value || 'null') as SettingsView;
  newKey.value = '';
  clearKey.value = false;
  saveError.value = null;
  issues.value = [];
}

export function useSettings() {
  return {
    draft,
    loading,
    saving,
    loadError,
    saveError,
    issues,
    newKey,
    clearKey,
    dirty,
    loadSettings,
    saveSettings,
    resetDraft,
  };
}
