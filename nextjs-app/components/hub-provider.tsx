'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { applyChange, businessDate, validateData } from '@/lib/domain';
import { emptyData, firebaseError, OWNER_EMAIL } from '@/lib/cloud-data';
import { firebaseGateway } from '@/lib/firebase-store';
import type { HubGateway, HubUser } from '@/lib/hub-gateway';
import type { AppData, Change, CollectionName } from '@/lib/types';

interface HubContext {
  data: AppData;
  ready: boolean;
  authReady: boolean;
  authenticated: boolean;
  user: HubUser | null;
  syncStatus: 'loading' | 'live' | 'offline' | 'error';
  syncError: string;
  busy: boolean;
  notice: string;
  changes: Change[];
  canUndo: boolean;
  save: (collection: CollectionName, record: Record<string, unknown>) => Promise<boolean>;
  remove: (collection: CollectionName, id: string) => Promise<boolean>;
  undo: () => Promise<boolean>;
  importData: (data: AppData) => Promise<boolean>;
  toggleRent: (id: string, month: string) => Promise<boolean>;
  runRecurring: () => Promise<boolean>;
  retry: () => void;
  notify: (message: string) => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<boolean>;
}
const Context = createContext<HubContext | null>(null);
export function HubProvider({
  children,
  gateway = firebaseGateway,
}: {
  children: ReactNode;
  gateway?: HubGateway;
}) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<HubUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<HubContext['syncStatus']>('loading');
  const [syncError, setSyncError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [changes, setChanges] = useState<Change[]>([]);
  const [last, setLast] = useState<Change | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [date, setDate] = useState(businessDate);
  const session = useRef(0);
  const currentUid = useRef<string | null>(null);
  const inFlight = useRef(false);
  const dataRef = useRef(data);
  const autoRun = useRef('');
  const notify = useCallback((message: string) => setNotice(message), []);

  useEffect(() => {
    let active = true;
    let stopData = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const report = (error: unknown) => {
      if (!active) return;
      setSyncError(firebaseError(error));
      setSyncStatus('error');
      setAuthReady(true);
    };
    let stopAuth = () => {};
    try {
      stopAuth = gateway.listenAuth((incoming) => {
        if (!active) return;
        stopData();
        clearTimeout(timer);
        const generation = ++session.current;
        currentUid.current = incoming?.uid ?? null;
        inFlight.current = false;
        autoRun.current = '';
        const blank = emptyData();
        dataRef.current = blank;
        setData(blank);
        setReady(false);
        setLast(null);
        setChanges([]);
        setNotice('');
        setBusy(false);
        setSyncError('');
        setAuthReady(true);
        if (!incoming || incoming.email?.toLowerCase() !== OWNER_EMAIL) {
          currentUid.current = null;
          setUser(null);
          setReady(true);
          setSyncStatus(incoming ? 'error' : 'loading');
          if (incoming) setSyncError('Chỉ tài khoản chủ sở hữu được đăng nhập.');
          return;
        }
        setUser(incoming);
        setSyncStatus('loading');
        const sameSession = () => active && session.current === generation;
        timer = setTimeout(() => {
          if (sameSession())
            report(
              new Error('Chưa tải được đầy đủ dữ liệu từ Firebase. Kiểm tra mạng rồi bấm Thử lại.'),
            );
        }, 20000);
        try {
          stopData = gateway.listenData(
            incoming.uid,
            (snapshot) => {
              if (!sameSession()) return;
              dataRef.current = snapshot.data;
              setData(snapshot.data);
              if (snapshot.complete) {
                clearTimeout(timer);
                setReady(true);
                setSyncError('');
                setSyncStatus(snapshot.fromCache ? 'offline' : 'live');
              }
            },
            (error) => {
              if (sameSession()) report(error);
            },
          );
        } catch (error) {
          report(error);
        }
      }, report);
    } catch (error) {
      report(error);
    }
    return () => {
      active = false;
      // This ref is a session generation, not a DOM ref: invalidate pending operations.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      session.current++;
      currentUid.current = null;
      clearTimeout(timer);
      stopData();
      stopAuth();
    };
  }, [gateway, attempt]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const timer = setInterval(() => setDate(businessDate()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function perform(work: (uid: string, generation: number) => Promise<void>) {
    if (!currentUid.current || !ready || syncStatus !== 'live' || syncError) {
      notify('Cần đăng nhập và kết nối Firebase đầy đủ trước khi thay đổi dữ liệu.');
      return false;
    }
    if (inFlight.current) {
      notify('Đang lưu lên Firebase. Vui lòng đợi thao tác hiện tại hoàn tất.');
      return false;
    }
    const uid = currentUid.current;
    const generation = session.current;
    inFlight.current = true;
    setBusy(true);
    try {
      await work(uid, generation);
      return session.current === generation;
    } catch (error) {
      if (session.current === generation) notify(firebaseError(error));
      return false;
    } finally {
      if (session.current === generation) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  async function commit(
    collection: CollectionName,
    id: string,
    record: Record<string, unknown> | null,
  ) {
    return perform(async (uid, generation) => {
      const result = applyChange(dataRef.current, collection, id, record);
      const change = await gateway.commit(uid, result.change);
      if (session.current !== generation) return;
      setLast(change);
      setChanges((c) => [change, ...c].slice(0, 60));
      notify(
        record
          ? 'Đã lưu lên Firebase.'
          : 'Đã xóa trên Firebase. Bạn có thể hoàn tác thao tác gần nhất.',
      );
    });
  }
  async function runRecurring() {
    return perform(async (uid, generation) => {
      await gateway.runRecurring(uid, dataRef.current.recurringTasks, businessDate());
      if (session.current === generation)
        notify('Đã kiểm tra các lịch định kỳ đến hạn trên Firebase.');
    });
  }
  const recurringSignature = JSON.stringify(data.recurringTasks);
  useEffect(() => {
    if (!ready || !user || syncStatus !== 'live' || busy || syncError) return;
    const key = `${user.uid}:${date}:${recurringSignature}`;
    if (autoRun.current === key || !data.recurringTasks.length) return;
    // Use the same transactional path as the legacy app; never seed demo tasks.
    const timer = setTimeout(() => {
      autoRun.current = key;
      void runRecurring();
    }, 0);
    return () => clearTimeout(timer);
    // The signature tracks schedule changes without rerunning for every snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, syncStatus, busy, syncError, date, recurringSignature]);

  const value: HubContext = {
    data,
    ready,
    authReady,
    authenticated: !!user,
    user,
    syncStatus,
    syncError,
    busy,
    notice,
    changes,
    canUndo: !!last && !busy && syncStatus === 'live',
    notify,
    retry: () => {
      setSyncError('');
      setReady(false);
      setAttempt((n) => n + 1);
    },
    save: (collection, record) =>
      commit(
        collection,
        typeof record.id === 'string' && record.id ? record.id : crypto.randomUUID(),
        record,
      ),
    remove: (collection, id) => commit(collection, id, null),
    undo: () =>
      perform(async (uid, generation) => {
        if (!last) return;
        await gateway.commit(uid, { ...last, before: last.after, after: last.before });
        if (session.current === generation) {
          setLast(null);
          notify('Đã hoàn tác trên Firebase.');
        }
      }),
    importData: (incoming) =>
      perform(async (uid, generation) => {
        const validated = validateData(incoming);
        await gateway.importData(uid, validated, (written, total) => {
          if (session.current === generation)
            notify(`Đang gộp backup lên Firebase: ${written}/${total} bản ghi.`);
        });
        if (session.current === generation) {
          setLast(null);
          notify('Đã gộp backup lên Firebase.');
        }
      }),
    toggleRent: (id, month) =>
      perform(async (uid, generation) => {
        await gateway.toggleRent(uid, id, month);
        if (session.current === generation) notify('Đã cập nhật thu tiền thuê trên Firebase.');
      }),
    runRecurring,
    signIn: async (email, password) => {
      setSyncError('');
      try {
        await gateway.signIn(email, password);
        return true;
      } catch (error) {
        setSyncError(firebaseError(error));
        return false;
      }
    },
    signOut: async () => {
      try {
        await gateway.signOut();
        return true;
      } catch (error) {
        notify(firebaseError(error));
        return false;
      }
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useHub() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('HubProvider is required');
  return ctx;
}
