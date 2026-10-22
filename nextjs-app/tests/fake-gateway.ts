import type { HubGateway, HubSnapshot, HubUser } from '@/lib/hub-gateway';
import type { AppData, Change } from '@/lib/types';
import { materializeRecurring, mergeBackup, setRentPaid } from '@/lib/domain';
import { OWNER_EMAIL, sameRecord } from '@/lib/cloud-data';

// Test-only backend. Never imported by the application.
export class FakeGateway implements HubGateway {
  user: HubUser | null = { uid: 'owner-test', email: OWNER_EMAIL };
  authListeners = new Set<(user: HubUser | null) => void>();
  dataListeners = new Set<(snapshot: HubSnapshot) => void>();
  errorListeners = new Set<(error: unknown) => void>();
  writes: Change[] = [];
  failure: Error | null = null;
  complete = true;
  fromCache = false;
  constructor(public data: AppData) {}
  listenAuth: HubGateway['listenAuth'] = (next) => {
    this.authListeners.add(next);
    queueMicrotask(() => {
      if (this.authListeners.has(next)) next(this.user);
    });
    return () => {
      this.authListeners.delete(next);
    };
  };
  listenData: HubGateway['listenData'] = (_uid, next, error) => {
    this.dataListeners.add(next);
    this.errorListeners.add(error);
    queueMicrotask(() => {
      if (this.dataListeners.has(next)) this.emit();
    });
    return () => {
      this.dataListeners.delete(next);
      this.errorListeners.delete(error);
    };
  };
  emit() {
    this.dataListeners.forEach((next) =>
      next({ data: this.data, complete: this.complete, fromCache: this.fromCache }),
    );
  }
  emitUser(user: HubUser | null) {
    this.user = user;
    this.authListeners.forEach((next) => next(user));
  }
  signIn: HubGateway['signIn'] = async (email, password) => {
    if (email !== OWNER_EMAIL || password !== 'fixture-password')
      throw Object.assign(new Error('Invalid credentials'), { code: 'auth/invalid-credential' });
    this.emitUser({ uid: 'owner-test', email });
  };
  signOut = async () => {
    this.emitUser(null);
  };
  commit: HubGateway['commit'] = async (_uid, change) => {
    if (this.failure) throw this.failure;
    const current = this.data[change.collection].find((r) => r.id === change.id) ?? null;
    if (!sameRecord(current, change.before)) throw new Error('Concurrent modification');
    const rows = this.data[change.collection].filter((r) => r.id !== change.id);
    if (change.after) rows.unshift(change.after);
    this.data = { ...this.data, [change.collection]: rows };
    this.writes.push(change);
    this.emit();
    return change;
  };
  importData: HubGateway['importData'] = async (_uid, incoming, progress) => {
    if (this.failure) throw this.failure;
    this.data = mergeBackup(this.data, incoming);
    const count = Object.values(incoming).reduce((sum, rows) => sum + rows.length, 0);
    progress(count, count);
    this.emit();
  };
  toggleRent: HubGateway['toggleRent'] = async (_uid, id, month) => {
    if (this.failure) throw this.failure;
    this.data = setRentPaid(this.data, id, month);
    this.emit();
  };
  runRecurring: HubGateway['runRecurring'] = async (_uid, _tasks, date) => {
    if (this.failure) throw this.failure;
    this.data = materializeRecurring(this.data, date);
    this.emit();
  };
}
