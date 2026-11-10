import { computed, ref } from 'vue';
import { api, ApiError } from '../api/client';

interface MeResponse {
  initialized: boolean;
  authenticated: boolean;
  mustChangePassword: boolean;
  setupRequiresToken: boolean;
}

const authenticated = ref(false);
const mustChangePassword = ref(false);
const initialized = ref(true);
const setupRequiresToken = ref(false);
const loaded = ref(false);
let inflight: Promise<void> | null = null;

async function fetchMe(): Promise<void> {
  try {
    const data = await api<MeResponse>('/api/auth/me');
    initialized.value = data.initialized;
    authenticated.value = data.authenticated;
    mustChangePassword.value = data.mustChangePassword;
    setupRequiresToken.value = data.setupRequiresToken;
  } catch {
    authenticated.value = false;
    mustChangePassword.value = false;
  } finally {
    loaded.value = true;
  }
}

async function refresh(): Promise<void> {
  inflight = null;
  await fetchMe();
}

async function ensureLoaded(): Promise<void> {
  if (loaded.value) return;
  if (!inflight) inflight = fetchMe();
  await inflight;
}

async function login(password: string, remember: boolean): Promise<ApiError | null> {
  try {
    const data = await api<MeResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password, remember }),
    });
    initialized.value = data.initialized ?? true;
    authenticated.value = true;
    mustChangePassword.value = data.mustChangePassword;
    loaded.value = true;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    return new ApiError(0, 'NETWORK_ERROR', null);
  }
}

async function logout(): Promise<void> {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    authenticated.value = false;
    mustChangePassword.value = false;
  }
}

async function changePassword(oldPassword: string, newPassword: string): Promise<ApiError | null> {
  try {
    await api('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    mustChangePassword.value = false;
    authenticated.value = true;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    return new ApiError(0, 'NETWORK_ERROR', null);
  }
}

async function setup(password: string, token: string): Promise<ApiError | null> {
  try {
    await api('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password, token }),
    });
    initialized.value = true;
    authenticated.value = true;
    mustChangePassword.value = false;
    loaded.value = true;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    return new ApiError(0, 'NETWORK_ERROR', null);
  }
}

export function useSession() {
  return {
    initialized: computed(() => initialized.value),
    authenticated: computed(() => authenticated.value),
    mustChangePassword: computed(() => mustChangePassword.value),
    setupRequiresToken: computed(() => setupRequiresToken.value),
    refresh,
    ensureLoaded,
    login,
    setup,
    logout,
    changePassword,
  };
}
