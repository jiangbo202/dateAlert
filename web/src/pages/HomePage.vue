<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ReminderCard from '../components/ReminderCard.vue';
import ReminderDrawer from '../components/ReminderDrawer.vue';
import ReminderFormDialog from '../components/ReminderFormDialog.vue';
import LanguageMenu from '../components/LanguageMenu.vue';
import { getReminder, type ReminderItem } from '../api/admin';
import { usePublicReminders } from '../composables/usePublicReminders';
import { useSession } from '../composables/useSession';
import { useTheme } from '../composables/useTheme';
import { useToast } from '../composables/useToast';
import { t } from '../i18n';

const router = useRouter();
const { items, total, today, tz, loading, loadingMore, error, hasMore, load, loadMore } = usePublicReminders();
const { authenticated } = useSession();
const { toggleTheme } = useTheme();
const { showToast } = useToast();

const lockHighlight = ref(false);
const clickCounts = new Map<string, number>();
let lockTimer: number | undefined;

const drawerOpen = ref(false);
const drawerItem = ref<ReminderItem | null>(null);
const formOpen = ref(false);
const formItem = ref<ReminderItem | null>(null);

const datedItems = computed(() => items.value.filter((item) => item.daysLeft !== null));
const undatedItems = computed(() => items.value.filter((item) => item.daysLeft === null));
const summary = computed(() =>
  today.value ? t('home.summary', { date: today.value, tz: tz.value, total: total.value }) : '',
);

async function openDetail(id: string): Promise<void> {
  try {
    drawerItem.value = await getReminder(id);
    drawerOpen.value = true;
  } catch {
    await router.push({ name: 'login', query: { next: '/' } });
  }
}

function onCardClick(id: string): void {
  if (authenticated.value) {
    void openDetail(id);
    return;
  }
  const next = (clickCounts.get(id) ?? 0) + 1;
  clickCounts.set(id, next);
  if (next < 3) return;

  clickCounts.delete(id);
  showToast(t('home.loginRequired'));
  lockHighlight.value = true;
  window.clearTimeout(lockTimer);
  lockTimer = window.setTimeout(() => (lockHighlight.value = false), 2000);
}

async function onDrawerChanged(): Promise<void> {
  await load();
}

function openEdit(item: ReminderItem): void {
  drawerOpen.value = false;
  formItem.value = item;
  formOpen.value = true;
}

async function onSaved(): Promise<void> {
  formOpen.value = false;
  await load();
  if (drawerItem.value) {
    try {
      drawerItem.value = await getReminder(drawerItem.value.id);
      drawerOpen.value = true;
    } catch {
      drawerItem.value = null;
    }
  }
}

onMounted(() => {
  void useSession().ensureLoaded();
});

onBeforeUnmount(() => window.clearTimeout(lockTimer));
</script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-[1200px] px-4 py-6 sm:px-8">
    <header class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <h1 class="shrink-0 text-lg font-semibold tracking-tight">{{ t('brand') }}</h1>
        <p v-if="summary" class="truncate text-xs text-muted">{{ summary }}</p>
      </div>

      <nav class="flex shrink-0 items-center gap-1">
        <LanguageMenu />

        <button
          type="button"
          :aria-label="t('nav.theme')"
          :title="t('nav.theme')"
          class="grid h-9 w-9 place-items-center rounded-control text-muted transition hover:bg-black/5 hover:text-main dark:hover:bg-white/10"
          @click="toggleTheme"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        </button>

        <RouterLink
          v-if="authenticated"
          to="/admin"
          :aria-label="t('nav.admin')"
          :title="t('nav.admin')"
          class="grid h-9 w-9 place-items-center rounded-control text-muted transition hover:bg-black/5 hover:text-main dark:hover:bg-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </RouterLink>

        <RouterLink
          v-else
          to="/login"
          :aria-label="t('nav.login')"
          :title="t('nav.login')"
          :class="[
            'grid h-9 w-9 place-items-center rounded-control transition',
            lockHighlight
              ? 'bg-accent/10 text-accent ring-2 ring-accent'
              : 'text-muted hover:bg-black/5 hover:text-main dark:hover:bg-white/10',
          ]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </RouterLink>
      </nav>
    </header>

    <main class="mt-6">
      <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="n in 8" :key="n" class="h-[132px] animate-pulse rounded-card bg-black/5 dark:bg-white/5" />
      </div>

      <p v-else-if="error" class="rounded-card bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
        {{ t('common.loadFailed') }}：{{ error }}
        <button type="button" class="ml-2 underline" @click="load()">{{ t('common.retry') }}</button>
      </p>

      <div v-else-if="items.length === 0" class="grid place-items-center py-24 text-center">
        <div class="text-5xl">🗓️</div>
        <p class="mt-4 text-base font-medium">{{ t('home.emptyTitle') }}</p>
        <p class="mt-1 text-xs text-muted">{{ t('home.emptyDesc') }}</p>
      </div>

      <template v-else>
        <div v-if="datedItems.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="item in datedItems" :key="item.id" class="min-w-0 cursor-pointer" @click="onCardClick(item.id)">
            <ReminderCard
              :title="item.title"
              :note="item.note"
              :days-left="item.daysLeft"
              :due-date="item.dueDate"
              :color="item.color"
              :label="item.label"
              :label-key="item.labelKey"
            />
          </div>
        </div>

        <section v-if="undatedItems.length" :class="datedItems.length ? 'mt-8' : ''">
          <h2 class="mb-3 text-sm font-medium text-muted">
            {{ t('home.sectionUndated', { n: undatedItems.length }) }}
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="item in undatedItems" :key="item.id" class="min-w-0 cursor-pointer" @click="onCardClick(item.id)">
              <ReminderCard
                :title="item.title"
                :note="item.note"
                :days-left="item.daysLeft"
                :due-date="item.dueDate"
                :color="item.color"
                :label="item.label"
                :label-key="item.labelKey"
              />
            </div>
          </div>
        </section>

        <div v-if="hasMore" class="mt-6 grid place-items-center">
          <button
            type="button"
            class="rounded-control border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
            :disabled="loadingMore"
            @click="loadMore()"
          >
            {{ loadingMore ? t('common.loading') : t('home.loadMore', { shown: items.length, total }) }}
          </button>
        </div>
      </template>
    </main>

    <ReminderDrawer
      :open="drawerOpen"
      :item="drawerItem"
      @close="drawerOpen = false"
      @changed="onDrawerChanged"
      @edit="openEdit"
    />
    <ReminderFormDialog :open="formOpen" :item="formItem" @close="formOpen = false" @saved="onSaved" />
  </div>
</template>
