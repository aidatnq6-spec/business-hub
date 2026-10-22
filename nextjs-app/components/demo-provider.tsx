'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createDemoData } from '@/lib/demo';
import {
  applyChange,
  businessDate,
  errorText,
  materializeRecurring,
  mergeBackup,
  setRentPaid,
  undoChange,
  validateData,
} from '@/lib/domain';
import type { AppData, Change, CollectionName } from '@/lib/types';

export const STORAGE_KEY = 'business-hub:next:mock:v1';
const SESSION_KEY = 'business-hub:next:demo-session';
interface HubContext {
  data: AppData;
  ready: boolean;
  authenticated: boolean;
  notice: string;
  changes: Change[];
  canUndo: boolean;
  save: (collection: CollectionName, record: Record<string, unknown>) => boolean;
  remove: (collection: CollectionName, id: string) => void;
  undo: () => void;
  reset: () => void;
  importData: (data: AppData) => void;
  toggleRent: (id: string, month: string) => void;
  runRecurring: () => void;
  notify: (message: string) => void;
  signIn: () => void;
  signOut: () => void;
}
const Context = createContext<HubContext | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(() => createDemoData());
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(true);
  const [notice, setNotice] = useState('');
  const [changes, setChanges] = useState<Change[]>([]);
  const [last, setLast] = useState<Change | null>(null);
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    let active = true;
    const load = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const restored = raw ? validateData(JSON.parse(raw)) : createDemoData();
        if (active) {
          setData(materializeRecurring(restored));
          setAuthenticated(sessionStorage.getItem(SESSION_KEY) !== 'signed-out');
        }
      } catch {
        if (active) setNotice('Dữ liệu mẫu đã lưu không hợp lệ. Đang dùng bộ dữ liệu mẫu mới.');
      }
      if (active) setReady(true);
    };
    queueMicrotask(load);
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const incoming = validateData(JSON.parse(event.newValue));
        setData(incoming);
        setLast(null);
      } catch {
        setNotice('Không thể đọc thay đổi dữ liệu mẫu từ tab khác.');
      }
    };
    window.addEventListener('storage', sync);
    return () => {
      active = false;
      window.removeEventListener('storage', sync);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      queueMicrotask(() =>
        setNotice('Bộ nhớ trình duyệt đầy hoặc bị chặn. Thay đổi chỉ được giữ trong phiên này.'),
      );
    }
  }, [data, ready]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!ready) return;
    let date = businessDate();
    const t = setInterval(() => {
      const next = businessDate();
      if (date !== next) {
        date = next;
        setData((d) => materializeRecurring(d, next));
      }
    }, 60000);
    return () => clearInterval(t);
  }, [ready]);
  function save(collection: CollectionName, record: Record<string, unknown>) {
    try {
      const id = typeof record.id === 'string' && record.id ? record.id : crypto.randomUUID();
      const result = applyChange(data, collection, id, record);
      const next =
        collection === 'recurringTasks' ? materializeRecurring(result.data) : result.data;
      setData(next);
      setLast(result.change);
      setChanges((c) => [result.change, ...c].slice(0, 60));
      notify('Đã lưu vào dữ liệu mẫu.');
      return true;
    } catch (error) {
      notify(errorText(error));
      return false;
    }
  }
  function remove(collection: CollectionName, id: string) {
    const result = applyChange(data, collection, id, null);
    setData(result.data);
    setLast(result.change);
    setChanges((c) => [result.change, ...c].slice(0, 60));
    notify('Đã xóa. Bạn có thể hoàn tác thao tác gần nhất.');
  }
  function undo() {
    if (!last) return;
    try {
      setData(undoChange(data, last));
      setLast(null);
      notify('Đã hoàn tác.');
    } catch (e) {
      notify(errorText(e));
    }
  }
  function reset() {
    setData(materializeRecurring(createDemoData()));
    setLast(null);
    setChanges([]);
    notify('Đã khôi phục bộ dữ liệu mẫu ban đầu.');
  }
  function importData(incoming: AppData) {
    setData(materializeRecurring(mergeBackup(data, incoming)));
    setLast(null);
    notify('Đã gộp backup vào dữ liệu mẫu.');
  }
  function signIn() {
    try {
      sessionStorage.setItem(SESSION_KEY, 'signed-in');
    } catch {
      notify('Trình duyệt đang chặn lưu phiên. Bạn vẫn có thể dùng bản mẫu trong tab này.');
    }
    setAuthenticated(true);
  }
  function signOut() {
    try {
      sessionStorage.setItem(SESSION_KEY, 'signed-out');
    } catch {
      /* End this in-memory demo session even if storage is unavailable. */
    }
    setAuthenticated(false);
    setLast(null);
    setNotice('');
  }
  return (
    <Context.Provider
      value={{
        data,
        ready,
        authenticated,
        notice,
        changes,
        canUndo: !!last,
        save,
        remove,
        undo,
        reset,
        importData,
        toggleRent: (id, month) => setData((d) => setRentPaid(d, id, month)),
        runRecurring: () => {
          setData((d) => materializeRecurring(d));
          notify('Đã kiểm tra các lịch định kỳ đến hạn.');
        },
        notify,
        signIn,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useHub() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('DemoProvider is required');
  return ctx;
}
