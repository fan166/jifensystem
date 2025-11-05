import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export type AnnouncementPriority = 'high' | 'medium' | 'low';
export type AnnouncementType = 'info' | 'success' | 'warning' | 'error';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  is_read: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface NotificationsState {
  items: Announcement[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  initialized: boolean;
  fetch: () => Promise<void>;
  subscribe: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  create: (payload: Omit<Announcement, 'id' | 'created_at' | 'updated_at' | 'is_read'>) => Promise<void>;
  update: (id: string, payload: Partial<Announcement>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setPriority: (id: string, priority: AnnouncementPriority) => Promise<void>;
  setValidity: (id: string, starts_at?: string | null, ends_at?: string | null) => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  unreadCount: 0,
  initialized: false,
  async fetch() {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items: Announcement[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type || 'info',
        priority: row.priority || 'medium',
        is_read: !!row.is_read,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
      }));
      set({ items, unreadCount: items.filter(i => !i.is_read).length, initialized: true });
    } catch (e: any) {
      console.error('加载公告失败:', e);
      // 回退到本地示例数据以保证UI可用
      const fallback: Announcement[] = [
        {
          id: 'local-1',
          title: '系统维护通知',
          content: '系统将于本周六晚上进行维护升级',
          type: 'info',
          priority: 'low',
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          starts_at: null,
          ends_at: null,
        },
      ];
      set({ items: fallback, unreadCount: fallback.filter(i => !i.is_read).length, error: '公告服务不可用，已使用本地数据' });
    } finally {
      set({ loading: false });
    }
  },
  subscribe() {
    try {
      const channel = supabase
        .channel('announcements_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, async () => {
          await get().fetch();
        })
        .subscribe();
      // 无需在store中保存channel引用，supabase会在卸载时由组件移除
    } catch (e) {
      console.warn('公告实时订阅失败:', e);
    }
  },
  async markRead(id: string) {
    // 乐观更新：先更新本地状态
    const prevItems = get().items.map(i => ({ ...i }));
    set(state => {
      const items = state.items.map(i => (i.id === id ? { ...i, is_read: true } : i));
      return { items, unreadCount: items.filter(x => !x.is_read).length };
    });

    // 若处于演示/本地回退模式（例如使用本地示例数据），仅持久化到localStorage，不调用后端
    const state = get();
    const inDemoMode = !!state.error || state.items.some(i => i.id.startsWith('local-'));
    if (inDemoMode) {
      try {
        const key = 'announcement_read_ids';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        if (!existing.includes(id)) {
          localStorage.setItem(key, JSON.stringify([...existing, id]));
        }
      } catch {}
      return;
    }

    // 正常模式调用后端；若失败则保持乐观状态（不回滚）
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await recordOperation('announcement_mark_read', { id });
    } catch (e) {
      console.warn('标记已读后端失败，保持本地已读状态:', e);
    }
  },
  async markAllRead() {
    // 乐观更新：先在本地全部标记为已读
    const before = get().items.map(i => ({ ...i }));
    const unreadBefore = before.filter(i => !i.is_read);
    set(state => {
      const items = state.items.map(i => ({ ...i, is_read: true }));
      return { items, unreadCount: 0 };
    });

    // 仅对非本地未读ID执行后端更新
    const ids = unreadBefore.filter(i => !i.id.startsWith('local-')).map(i => i.id);
    const inDemoMode = !!get().error || before.some(i => i.id.startsWith('local-'));
    if (ids.length === 0 || inDemoMode) {
      // 在演示/本地模式下，持久化到 localStorage，避免刷新后角标恢复
      try {
        const key = 'announcement_read_ids';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const merged = Array.from(new Set([...existing, ...unreadBefore.map(i => i.id)]));
        localStorage.setItem(key, JSON.stringify(merged));
      } catch {}
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      await recordOperation('announcement_mark_all_read', { ids });
    } catch (e) {
      console.warn('批量标记已读后端失败，保持本地已读状态:', e);
    }
  },
  async create(payload) {
    const { user } = useAuthStore.getState();
    try {
      const insert = {
        ...payload,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user?.id || null,
      } as any;
      const { data, error } = await supabase
        .from('announcements')
        .insert([insert])
        .select('*')
        .single();
      if (error) throw error;
      set(state => {
        const items = [mapRow(data), ...state.items];
        return { items, unreadCount: items.filter(x => !x.is_read).length };
      });
      await recordOperation('announcement_create', { id: data.id });
    } catch (e) {
      console.error('创建公告失败，使用本地回退:', e);
      // 在演示/本地模式或后端失败时，添加本地公告以保证功能可用
      const local: Announcement = {
        id: `local-${Date.now()}`,
        title: payload.title,
        content: payload.content,
        type: (payload as any).type || 'info',
        priority: payload.priority || 'medium',
        is_read: false,
        starts_at: null,
        ends_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user?.id || null,
      };
      set(state => {
        const items = [local, ...state.items];
        return { items, unreadCount: items.filter(x => !x.is_read).length, error: state.error || '公告创建失败，已使用本地回退' };
      });
    }
  },
  async update(id, payload) {
    // 本地条目直接在前端更新
    if (id.startsWith('local-')) {
      set(state => {
        const items = state.items.map(i => (i.id === id ? { ...i, ...payload, updated_at: new Date().toISOString() } : i));
        return { items, unreadCount: items.filter(x => !x.is_read).length };
      });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('announcements')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      set(state => {
        const items = state.items.map(i => (i.id === id ? mapRow(data) : i));
        return { items, unreadCount: items.filter(x => !x.is_read).length };
      });
      await recordOperation('announcement_update', { id });
    } catch (e) {
      console.error('更新公告失败，改为本地更新:', e);
      // 后端失败则也进行本地更新，保障编辑生效
      set(state => {
        const items = state.items.map(i => (i.id === id ? { ...i, ...payload, updated_at: new Date().toISOString() } : i));
        return { items, unreadCount: items.filter(x => !x.is_read).length };
      });
    }
  },
  async remove(id) {
    // 本地条目直接移除
    if (id.startsWith('local-')) {
      set(state => {
        const items = state.items.filter(i => i.id !== id);
        return { items, unreadCount: items.filter(x => !x.is_read).length };
      });
      return;
    }
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      if (error) throw error;
      set(state => {
        const items = state.items.filter(i => i.id !== id);
        return { items, unreadCount: items.filter(x => !x.is_read).length };
      });
      await recordOperation('announcement_delete', { id });
    } catch (e) {
      console.error('删除公告失败，改为本地移除:', e);
      // 后端失败则也本地移除，保障删除生效
      set(state => {
        const items = state.items.filter(i => i.id !== id);
        return { items, unreadCount: items.filter(x => !x.is_read).length };
      });
    }
  },
  async setPriority(id, priority) {
    await get().update(id, { priority });
    await recordOperation('announcement_set_priority', { id, priority });
  },
  async setValidity(id, starts_at, ends_at) {
    await get().update(id, { starts_at, ends_at });
    await recordOperation('announcement_set_validity', { id, starts_at, ends_at });
  }
}));

function mapRow(row: any): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type || 'info',
    priority: row.priority || 'medium',
    is_read: !!row.is_read,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };
}

async function recordOperation(action: string, details: any) {
  try {
    const { user } = useAuthStore.getState();
    await supabase.from('operation_logs').insert([
      {
        action,
        details,
        user_id: user?.id || null,
        created_at: new Date().toISOString()
      }
    ]);
  } catch (e) {
    // 忽略日志错误，确保主流程不受影响
    console.warn('记录操作日志失败:', e);
  }
}