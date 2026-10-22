import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { firebaseClient } from './firebase-client';
import { cloudRecord, COLLECTIONS, emptyData, OWNER_EMAIL, sameRecord } from './cloud-data';
import { materializeRecurring, validateData } from './domain';
import type { HubGateway } from './hub-gateway';
import type { AppData, Entity } from './types';

function session(uid: string) {
  const client = firebaseClient();
  if (
    client.auth.currentUser?.uid !== uid ||
    client.auth.currentUser.email?.toLowerCase() !== OWNER_EMAIL
  ) {
    throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.');
  }
  return client.db;
}
function encode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    // Preserve native Firestore values (Timestamp, GeoPoint, DocumentReference, Bytes).
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    if (
      'seconds' in value &&
      'nanoseconds' in value &&
      (Object.keys(value).length === 2 ||
        ('type' in value && value.type === 'firestore/timestamp/1.0'))
    ) {
      return new Timestamp(Number(value.seconds), Number(value.nanoseconds));
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, encode(v)]),
    );
  }
  return value;
}
function payload(row: Entity): Record<string, unknown> {
  const { id: _id, ...fields } = row;
  void _id;
  if (typeof fields.createdAt === 'string') {
    const date = new Date(fields.createdAt);
    if (!Number.isFinite(date.getTime())) throw new Error(`Thời điểm tạo không hợp lệ: ${row.id}`);
    fields.createdAt = Timestamp.fromDate(date);
  }
  return encode(fields) as Record<string, unknown>;
}
function timestampValue(row: Entity): Entity {
  const fields = payload(row);
  if (fields.createdAt instanceof Timestamp) {
    fields.createdAt = {
      seconds: fields.createdAt.seconds,
      nanoseconds: fields.createdAt.nanoseconds,
    };
  }
  return { ...fields, id: row.id } as Entity;
}

export const firebaseGateway: HubGateway = {
  listenAuth(next, error) {
    const { auth } = firebaseClient();
    return onAuthStateChanged(
      auth,
      (user) => {
        if (user && user.email?.toLowerCase() !== OWNER_EMAIL) {
          next(null);
          error(new Error('Ứng dụng riêng tư. Chỉ tài khoản chủ sở hữu được đăng nhập.'));
          void signOut(auth).catch(error);
        } else next(user ? { uid: user.uid, email: user.email } : null);
      },
      error,
    );
  },
  async signIn(email, password) {
    if (email.trim().toLowerCase() !== OWNER_EMAIL)
      throw new Error('Chỉ tài khoản chủ sở hữu của Business Hub được đăng nhập.');
    await signInWithEmailAndPassword(firebaseClient().auth, email.trim(), password);
  },
  async signOut() {
    await signOut(firebaseClient().auth);
  },
  listenData(uid, next, error) {
    const db = session(uid);
    const data = emptyData();
    const seen = new Set<string>();
    const cached = new Set<string>(COLLECTIONS);
    const errors = new Set<string>();
    const unsubscribers: (() => void)[] = [];
    try {
      for (const name of COLLECTIONS) {
        unsubscribers.push(
          onSnapshot(
            collection(db, 'users', uid, name),
            { includeMetadataChanges: true },
            (snapshot) => {
              try {
                const rows = snapshot.docs.map((item) => cloudRecord(name, item.id, item.data()));
                rows.sort((a, b) => {
                  const seconds = (r: Entity) =>
                    typeof r.createdAt === 'string'
                      ? Date.parse(r.createdAt) / 1000
                      : (r.createdAt?.seconds ?? 0);
                  return seconds(b) - seconds(a);
                });
                Object.assign(data, { [name]: rows });
                errors.delete(name);
                if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites)
                  seen.add(name);
                if (snapshot.metadata.fromCache) cached.add(name);
                else cached.delete(name);
                next({
                  data: { ...data },
                  complete: seen.size === COLLECTIONS.length && errors.size === 0,
                  fromCache: cached.size > 0,
                });
              } catch (e) {
                errors.add(name);
                error(e);
              }
            },
            (e) => {
              errors.add(name);
              error(e);
            },
          ),
        );
      }
    } catch (e) {
      unsubscribers.forEach((stop) => stop());
      throw e;
    }
    return () => unsubscribers.forEach((stop) => stop());
  },
  async commit(uid, change) {
    const db = session(uid);
    const ref = doc(db, 'users', uid, change.collection, change.id);
    const after = change.after
      ? cloudRecord(change.collection, change.id, timestampValue(change.after))
      : null;
    await runTransaction(db, async (tx) => {
      session(uid);
      const snapshot = await tx.get(ref);
      const current = snapshot.exists()
        ? cloudRecord(change.collection, snapshot.id, snapshot.data())
        : null;
      if (!sameRecord(current, change.before))
        throw new Error('Bản ghi đã thay đổi trên Firebase. Hãy tải dữ liệu mới và thử lại.');
      if (after) tx.set(ref, payload(after));
      else tx.delete(ref);
    });
    return { ...change, after };
  },
  async importData(uid, incoming, progress) {
    const data = validateData(incoming);
    // Encode every record before the first batch; malformed timestamps must not
    // produce a partially imported file merely because they appear in a later batch.
    const rows = COLLECTIONS.flatMap((name) =>
      data[name].map((row) => ({ name, id: row.id, fields: payload(row) })),
    );
    let written = 0;
    // Keep batches well below Firestore's 500-operation limit.
    try {
      for (let offset = 0; offset < rows.length; offset += 200) {
        const db = session(uid);
        const batch = writeBatch(db);
        for (const { name, id, fields } of rows.slice(offset, offset + 200)) {
          batch.set(doc(db, 'users', uid, name, id), fields, { merge: true });
        }
        await batch.commit();
        written += Math.min(200, rows.length - offset);
        progress(written, rows.length);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Firebase từ chối ghi dữ liệu';
      throw new Error(
        `Đã gộp ${written}/${rows.length} bản ghi. Phần còn lại chưa được ghi; có thể thử lại cùng file. ${reason}`,
      );
    }
  },
  async toggleRent(uid, apartmentId, month) {
    const db = session(uid);
    const [year, m] = month.split('-').map(Number);
    if (
      !/^\d{4}-\d{2}$/.test(month) ||
      m < 1 ||
      m > 12 ||
      year < 1900 ||
      !/^[A-Za-z0-9_-]+$/.test(apartmentId)
    )
      throw new Error('Căn hộ hoặc kỳ thu không hợp lệ.');
    const ref = doc(db, 'users', uid, 'rentPayments', `${year}_${m}_${apartmentId}`);
    await runTransaction(db, async (tx) => {
      session(uid);
      const snapshot = await tx.get(ref);
      const before = snapshot.exists() ? snapshot.data() : {};
      tx.set(
        ref,
        {
          apartmentId,
          month: m,
          year,
          paid: !before.paid,
          createdAt: before.createdAt ?? Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    });
  },
  async runRecurring(uid, tasks, date) {
    const db = session(uid);
    for (const candidate of tasks) {
      if (!materializeRecurring({ ...emptyData(), recurringTasks: [candidate] }, date).todos.length)
        continue;
      const id = `recur_${candidate.id}_${date}`;
      const taskRef = doc(db, 'users', uid, 'recurringTasks', candidate.id);
      const markerRef = doc(db, 'users', uid, 'recurringRuns', id);
      const todoRef = doc(db, 'users', uid, 'todos', id);
      // Re-read the schedule inside the transaction; another client may have disabled it.
      await runTransaction(db, async (tx) => {
        session(uid);
        const [taskSnapshot, marker, todo] = await Promise.all([
          tx.get(taskRef),
          tx.get(markerRef),
          tx.get(todoRef),
        ]);
        if (!taskSnapshot.exists() || marker.exists()) return;
        const task = cloudRecord(
          'recurringTasks',
          taskSnapshot.id,
          taskSnapshot.data(),
        ) as AppData['recurringTasks'][number];
        const result = materializeRecurring({ ...emptyData(), recurringTasks: [task] }, date);
        const generated = result.todos[0];
        if (!generated) return;
        if (!todo.exists()) tx.set(todoRef, { ...payload(generated), createdAt: Timestamp.now() });
        tx.set(markerRef, { recurringTaskId: task.id, date, createdAt: Timestamp.now() });
      });
    }
  },
};
