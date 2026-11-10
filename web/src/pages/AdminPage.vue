<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  archiveReminder,
  deleteReminder,
  purgeArchived,
  restoreReminder,
  type ReminderItem,
  type ReminderScope,
} from '../api/admin';
import LanguageMenu from '../components/LanguageMenu.vue';
import ReminderFormDialog from '../components/ReminderFormDialog.vue';
import ReminderDrawer from '../components/ReminderDrawer.vue';
import SettingsTab from '../components/settings/SettingsTab.vue';
import { useAdminReminders } from '../composables/useAdminReminders';
import { confirm } from '../composables/useConfirm';
import { useSession } from '../composables/useSession';
import { useTheme } from '../composables/useTheme';
import { useToast } from '../composables/useToast';
import { t } from '../i18n';

const router = useRouter();
const { logout } = useSession();
const { toggleTheme } = useTheme();
const { showToast } = useToast();

const tab = ref<'reminders' | 'settings'>('reminders');
const { items, total, page, size, scope, keyword, loading, error, reload, setScope, setKeyword, setPage } =
  useAdminReminders();

const drawerOpen = ref(false);
const drawerItem = ref<ReminderItem | null>(null);
const formOpen = ref(false);
const formItem = ref<ReminderItem | null>(null);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size.value)));
const scopeOptions = computed<Array<{ value: ReminderScope; label: string }>>(() => [
  { value: 'active', label: t('list.scope.active') },
  { value: 'archived', label: t('list.scope.archived') },
  { value: 'undated', label: t('list.scope.undated') },
  { value: 'all', label: t('list.scope.all') },
]);

function openCreate(): void {
  formItem.value = null;
  formOpen.value = true;
}

function openEdit(item: ReminderItem): void {
  drawerOpen.value = false;
  formItem.value = item;
  formOpen.value = true;
}

async function onSaved(item: ReminderItem): Promise<void> {
  showToast(item.isDone ? t('form.savedArchived') : t('form.saved'));
  await reload();
  if (drawerOpen.value) drawerItem.value = item;
}

function openDetail(item: ReminderItem): void {
  drawerItem.value = item;
  drawerOpen.value = true;
}

async function onChanged(item: ReminderItem | null): Promise<void> {
  drawerItem.value = item;
  if (!item) drawerOpen.value = false;
  await reload();
}

async function quickArchive(item: ReminderItem): Promise<void> {
  try {
    const updated = item.isDone ? await restoreReminder(item.id) : await archiveReminder(item.id);
    showToast(item.isDone ? t('drawer.restored') : t('drawer.archived'));
    if (drawerOpen.value) drawerItem.value = updated;
    await reload();
  } catch {
    showToast(t('drawer.failed'));
  }
}

async function quickDelete(item: ReminderItem): Promise<void> {
  const ok = await confirm({
    title: t('drawer.deleteTitle'),
    message: t('drawer.deleteBody', { title: item.title }),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true,
  });
  if (!ok) return;
  try {
    await deleteReminder(item.id);
    showToast(t('drawer.deleted'));
    if (drawerOpen.value) drawerOpen.value = false;
    await reload();
  } catch {
    showToast(t('drawer.deleteFailed'));
  }
}

async function clearArchived(): Promise<void> {
  const ok = await confirm({
    title: t('data.purgeTitle'),
    message: t('data.purgeBody'),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true,
  });
  if (!ok) return;
  try {
    const deleted = await purgeArchived();
    showToast(t('data.purged', { n: deleted }));
    await reload();
  } catch {
    showToast(t('drawer.failed'));
  }
}

async function signOut(): Promise<void> {
  await logout();
  await router.replace('/');
}

function daysLabel(item: ReminderItem): string {
  if (item.daysLeft === null) return t('status.undated');
  if (item.daysLeft === 0) return t('list.today');
  if (item.daysLeft < 0) return t('list.overdue', { n: Math.abs(item.daysLeft) });
  return t('day.leftShort', { n: item.daysLeft });
}

async function refreshAfterSettings(): Promise<void> {
  if (tab.value === 'reminders') await reload();
}

onMounted(() => void reload());
</script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-[1200px] px-4 py-6 sm:px-8">
    <header class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <RouterLink to="/" class="shrink-0 text-lg font-semibold tracking-tight">{{ t('brand') }}</RouterLink>
        <span class="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted dark:bg-white/10">{{ t('admin.badge') }}</span>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <LanguageMenu />
        <button
          type="button"
          :aria-label="t('nav.theme')"
          class="grid h-9 w-9 place-items-center rounded-control text-muted transition hover:bg-black/5 hover:text-main dark:hover:bg-white/10"
          @click="toggleTheme"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        </button>
        <RouterLink
          to="/change-password"
          class="hidden rounded-control px-3 py-1.5 text-xs text-muted transition hover:bg-black/5 hover:text-main sm:block dark:hover:bg-white/10"
        >
          {{ t('nav.changePassword') }}
        </RouterLink>
        <button
          type="button"
          class="rounded-control px-3 py-1.5 text-xs text-muted transition hover:bg-black/5 hover:text-main dark:hover:bg-white/10"
          @click="signOut"
        >
          {{ t('nav.logout') }}
        </button>
      </div>
    </header>

    <nav class="mt-6 flex gap-1 border-b border-line">
      <button
        type="button"
        class="relative px-3 py-2 text-sm transition"
        :class="tab === 'reminders' ? 'font-medium text-accent' : 'text-muted hover:text-main'"
        @click="tab = 'reminders'"
      >
        {{ t('admin.tab.reminders') }}
        <span v-if="tab === 'reminders'" class="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
      </button>
      <button
        type="button"
        class="relative px-3 py-2 text-sm transition"
        :class="tab === 'settings' ? 'font-medium text-accent' : 'text-muted hover:text-main'"
        @click="tab = 'settings'"
      >
        {{ t('admin.tab.settings') }}
        <span v-if="tab === 'settings'" class="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
      </button>
    </nav>

    <main class="py-6">
      <section v-if="tab === 'reminders'">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              @click="openCreate"
            >
              {{ t('list.create') }}
            </button>
            <select
              :value="scope"
              class="rounded-control border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
              @change="setScope(($event.target as HTMLSelectElement).value as ReminderScope)"
            >
              <option v-for="option in scopeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <input
              :value="keyword"
              type="search"
              :placeholder="t('list.search')"
              class="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent sm:w-56"
              @input="setKeyword(($event.target as HTMLInputElement).value)"
            />
            <button
              v-if="scope === 'archived'"
              type="button"
              class="shrink-0 rounded-control border border-red-200 px-3 py-2 text-xs text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
              @click="clearArchived"
            >
              {{ t('list.clearArchived') }}
            </button>
          </div>
        </div>

        <p v-if="error" class="mt-4 rounded-card bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {{ t('common.loadFailed') }}：{{ error }}
          <button type="button" class="ml-2 underline" @click="reload()">{{ t('common.retry') }}</button>
        </p>

        <div v-if="loading" class="mt-4 space-y-2">
          <div v-for="n in 5" :key="n" class="h-14 animate-pulse rounded-card bg-black/5 dark:bg-white/5" />
        </div>

        <div v-else-if="items.length === 0" class="mt-6 grid place-items-center rounded-card border border-dashed border-line py-16 text-center">
          <div class="text-4xl">📭</div>
          <p class="mt-3 text-sm font-medium">
            {{ scope === 'archived' ? t('list.emptyArchived') : t('list.emptyActive') }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ scope === 'archived' ? t('list.emptyArchivedDesc') : t('list.emptyActiveDesc') }}
          </p>
        </div>

        <template v-else>
          <div class="mt-4 hidden overflow-hidden rounded-card border border-line sm:block">
            <table class="w-full text-sm">
              <thead class="bg-black/[0.02] text-left text-xs text-muted dark:bg-white/[0.03]">
                <tr>
                  <th class="px-4 py-2.5 font-medium">{{ t('list.col.title') }}</th>
                  <th class="px-4 py-2.5 font-medium">{{ t('list.col.due') }}</th>
                  <th class="px-4 py-2.5 font-medium">{{ t('list.col.left') }}</th>
                  <th class="px-4 py-2.5 font-medium">{{ t('list.col.public') }}</th>
                  <th class="px-4 py-2.5 text-right font-medium">{{ t('list.col.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in items"
                  :key="item.id"
                  class="border-t border-line transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <td class="max-w-[280px] px-4 py-3">
                    <button type="button" class="max-w-full truncate text-left font-medium hover:text-accent" @click="openDetail(item)">
                      {{ item.title }}
                    </button>
                    <p v-if="item.note" class="truncate text-xs text-muted">{{ item.note }}</p>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-xs text-muted">{{ item.dueDate || t('common.none') }}</td>
                  <td class="whitespace-nowrap px-4 py-3">
                    <span
                      class="rounded-full px-2 py-0.5 text-xs"
                      :style="{ background: `color-mix(in srgb, ${item.color} 14%, transparent)`, color: item.color }"
                    >
                      {{ item.labelKey ? t(`status.${item.labelKey}`) : item.label }} · {{ daysLabel(item) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-xs text-muted">{{ item.isPublic ? t('common.yes') : t('common.no') }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" class="rounded-control px-2 py-1 text-xs text-muted transition hover:text-accent" @click="openEdit(item)">
                      {{ t('common.edit') }}
                    </button>
                    <button type="button" class="rounded-control px-2 py-1 text-xs text-muted transition hover:text-accent" @click="quickArchive(item)">
                      {{ item.isDone ? t('list.restore') : t('list.archive') }}
                    </button>
                    <button type="button" class="rounded-control px-2 py-1 text-xs text-red-500 transition hover:text-red-600" @click="quickDelete(item)">
                      {{ t('common.delete') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-4 space-y-2 sm:hidden">
            <div v-for="item in items" :key="item.id" class="rounded-card border border-line p-3">
              <div class="flex items-start justify-between gap-2">
                <button type="button" class="min-w-0 flex-1 text-left" @click="openDetail(item)">
                  <p class="truncate font-medium">{{ item.title }}</p>
                  <p class="mt-0.5 text-xs text-muted">
                    {{ item.dueDate || t('status.undated') }} · {{ item.isPublic ? t('list.col.public') : t('common.no') }}
                  </p>
                </button>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-xs"
                  :style="{ background: `color-mix(in srgb, ${item.color} 14%, transparent)`, color: item.color }"
                >
                  {{ daysLabel(item) }}
                </span>
              </div>
              <div class="mt-2 flex gap-2">
                <button type="button" class="rounded-control border border-line px-2 py-1 text-xs" @click="openEdit(item)">
                  {{ t('common.edit') }}
                </button>
                <button type="button" class="rounded-control border border-line px-2 py-1 text-xs" @click="quickArchive(item)">
                  {{ item.isDone ? t('list.restore') : t('list.archive') }}
                </button>
                <button type="button" class="rounded-control border border-red-200 px-2 py-1 text-xs text-red-600" @click="quickDelete(item)">
                  {{ t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between text-xs text-muted">
            <span>{{ t('list.pageInfo', { total, page, pages: totalPages }) }}</span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded-control border border-line px-2.5 py-1 transition disabled:opacity-40"
                :disabled="page <= 1"
                @click="setPage(page - 1)"
              >
                {{ t('list.prev') }}
              </button>
              <button
                type="button"
                class="rounded-control border border-line px-2.5 py-1 transition disabled:opacity-40"
                :disabled="page >= totalPages"
                @click="setPage(page + 1)"
              >
                {{ t('list.next') }}
              </button>
            </div>
          </div>
        </template>
      </section>

      <section v-else>
        <SettingsTab @changed="refreshAfterSettings" />
      </section>
    </main>

    <ReminderFormDialog :open="formOpen" :item="formItem" @close="formOpen = false" @saved="onSaved" />
    <ReminderDrawer
      :open="drawerOpen"
      :item="drawerItem"
      @close="drawerOpen = false"
      @changed="onChanged"
      @edit="openEdit"
    />
  </div>
</template>
