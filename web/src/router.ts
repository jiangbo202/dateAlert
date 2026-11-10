import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';
import LoginPage from './pages/LoginPage.vue';
import SetupPage from './pages/SetupPage.vue';
import ChangePasswordPage from './pages/ChangePasswordPage.vue';
import AdminPage from './pages/AdminPage.vue';
import { useSession } from './composables/useSession';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage, meta: { public: true } },
    { path: '/login', name: 'login', component: LoginPage, meta: { public: true } },
    { path: '/setup', name: 'setup', component: SetupPage, meta: { public: true } },
    { path: '/change-password', name: 'change-password', component: ChangePasswordPage },
    { path: '/admin', name: 'admin', component: AdminPage },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const { initialized, authenticated, mustChangePassword, ensureLoaded } = useSession();
  await ensureLoaded();

  // 尚未初始化：强制进入设置密码页
  if (!initialized.value) {
    return to.name === 'setup' ? true : { name: 'setup' };
  }
  if (to.name === 'setup') {
    return { name: authenticated.value ? 'admin' : 'login' };
  }

  if (to.meta.public) {
    if (authenticated.value && to.name === 'login' && !mustChangePassword.value) return { name: 'admin' };
    return true;
  }

  if (!authenticated.value) return { name: 'login', query: { next: to.fullPath } };

  if (mustChangePassword.value && to.name !== 'change-password') return { name: 'change-password' };
  if (!mustChangePassword.value && to.name === 'change-password') return { name: 'admin' };

  return true;
});
