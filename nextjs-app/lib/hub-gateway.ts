import type { AppData, Change, RecurringTask } from './types';

export interface HubUser {
  uid: string;
  email: string | null;
}
export interface HubSnapshot {
  data: AppData;
  complete: boolean;
  fromCache: boolean;
}
export interface HubGateway {
  listenAuth: (next: (user: HubUser | null) => void, error: (error: unknown) => void) => () => void;
  listenData: (
    uid: string,
    next: (snapshot: HubSnapshot) => void,
    error: (error: unknown) => void,
  ) => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  commit: (uid: string, change: Change) => Promise<Change>;
  importData: (
    uid: string,
    data: AppData,
    progress: (written: number, total: number) => void,
  ) => Promise<void>;
  toggleRent: (uid: string, apartmentId: string, month: string) => Promise<void>;
  runRecurring: (uid: string, tasks: RecurringTask[], date: string) => Promise<void>;
}
