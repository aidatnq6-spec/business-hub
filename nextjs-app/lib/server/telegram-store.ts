import 'server-only';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { cloudRecord, emptyData } from '../cloud-data';
import { materializeRecurring } from '../domain';
import { REPORT_LEASE_MS, type TelegramJobStore, type TelegramRun } from '../telegram-job';
import { claimTelegramRun } from '../telegram-run-state';

const runSchema = z.object({
  date: z.string(), destination: z.string(), attempt: z.string(),
  status: z.enum(['preparing', 'sending', 'sent', 'failed', 'uncertain']),
  chunks: z.array(z.string().max(4096)).max(100).nullable(),
  nextPart: z.number().int().min(0), inFlight: z.number().int().min(0).nullable(),
  messageIds: z.array(z.number().int()), leaseUntil: z.number(), retryAt: z.number(),
  updatedAt: z.string(), errorCode: z.string().nullable(),
});

export function telegramStore(db: Firestore, uid: string): TelegramJobStore {
  if (!uid || uid.includes('/')) throw new Error('invalid_owner_uid');
  const root = db.collection('users').doc(uid);
  const runRef = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid_report_date');
    return root.collection('telegramReports').doc(date);
  };
  async function changeRun(date: string, attempt: string, mutate: (run: TelegramRun) => TelegramRun) {
    const ref = runRef(date);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error('report_run_missing');
      const run = runSchema.parse(snapshot.data());
      if (run.attempt !== attempt) throw new Error('report_lease_lost');
      tx.set(ref, mutate(run));
    });
  }
  return {
    async claim(date, attempt, destination, now) {
      const ref = runRef(date);
      return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const current = snapshot.exists ? runSchema.parse(snapshot.data()) : null;
        const result = claimTelegramRun(current, date, attempt, destination, now);
        if (result.update) tx.set(ref, result.update);
        return result.claim;
      });
    },
    async prepareData(date) {
      const schedules = await root.collection('recurringTasks').get();
      for (const snapshot of schedules.docs) {
        const task = cloudRecord('recurringTasks', snapshot.id, snapshot.data());
        if (!materializeRecurring({ ...emptyData(), recurringTasks: [task] }, date).todos.length) continue;
        const id = `recur_${task.id}_${date}`;
        const markerRef = root.collection('recurringRuns').doc(id);
        const todoRef = root.collection('todos').doc(id);
        await db.runTransaction(async (tx) => {
          const [latest, marker, todo] = await Promise.all([tx.get(snapshot.ref), tx.get(markerRef), tx.get(todoRef)]);
          if (!latest.exists || marker.exists) return;
          const current = cloudRecord('recurringTasks', latest.id, latest.data()!);
          const generated = materializeRecurring({ ...emptyData(), recurringTasks: [current] }, date).todos[0];
          if (!generated) return;
          if (!todo.exists) {
            const { id: _id, ...fields } = generated;
            void _id;
            tx.set(todoRef, { ...fields, createdAt: Timestamp.now() });
          }
          tx.set(markerRef, { recurringTaskId: current.id, date, createdAt: Timestamp.now() });
        });
      }
      const data = emptyData();
      const names = ['transactions', 'debts', 'todos', 'recurringTasks', 'recurringRuns'] as const;
      await Promise.all(names.map(async (name) => {
        const snapshot = await root.collection(name).get();
        Object.assign(data, { [name]: snapshot.docs.map((item) => cloudRecord(name, item.id, item.data())) });
      }));
      return data;
    },
    async saveChunks(date, attempt, chunks, now) {
      await changeRun(date, attempt, (run) => {
        if (run.chunks || run.status !== 'preparing') throw new Error('report_already_prepared');
        return { ...run, chunks, status: 'sending', updatedAt: now.toISOString(), leaseUntil: now.getTime() + REPORT_LEASE_MS };
      });
    },
    async beginPart(date, attempt, index, now) {
      await changeRun(date, attempt, (run) => {
        if (run.status !== 'sending' || run.nextPart !== index || run.inFlight !== null || !run.chunks?.[index]) throw new Error('report_part_conflict');
        return { ...run, inFlight: index, updatedAt: now.toISOString(), leaseUntil: now.getTime() + REPORT_LEASE_MS };
      });
    },
    async confirmPart(date, attempt, index, messageId, now) {
      await changeRun(date, attempt, (run) => {
        if (run.status !== 'sending' || run.inFlight !== index || run.nextPart !== index) throw new Error('report_ack_conflict');
        const finished = index + 1 === run.chunks?.length;
        return { ...run, inFlight: null, nextPart: index + 1, messageIds: [...run.messageIds, messageId], status: finished ? 'sent' : 'sending', updatedAt: now.toISOString(), leaseUntil: finished ? 0 : now.getTime() + REPORT_LEASE_MS };
      });
    },
    async fail(date, attempt, code, uncertain, retryAt, now) {
      await changeRun(date, attempt, (run) => {
        if (run.status === 'sent') return run;
        return { ...run, status: uncertain ? 'uncertain' : 'failed', inFlight: uncertain ? run.inFlight : null, errorCode: code, retryAt, leaseUntil: 0, updatedAt: now.toISOString() };
      });
    },
  };
}
