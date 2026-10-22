import 'server-only';
import { businessDay, nextDay } from '../../marketing/domain';
import type { Bundle, Plan } from '../../marketing/types';
import { collection, read, type Context } from './store';
import { createDailyBundle, errorResponse, response } from './api';
import { requireGeneration, marketingConfig, required } from './config';
import { scheduleAuth } from './auth';
import { ownerContext } from '../firebase-admin';
import { flushOutbox } from './tasks';
import { telegramSender, TelegramDeliveryError } from '../../telegram-transport';
export async function prepareDay(c: Context, date: string) {
  await requireGeneration(c);
  const plan = await read<Plan>(c, 'marketingPlans', date.slice(0, 7));
  if (!plan?.approved) return { state: 'no_approved_plan', count: 0 };
  const items = plan.items.filter((x) => x.date === date && (x.approved ?? plan.approved));
  for (const item of items) await createDailyBundle(c, item, plan);
  const dispatch = await flushOutbox(c);
  return { state: 'queued', count: items.length, dispatch };
}
export function notificationText(day: string, bundles: Bundle[]) {
  const ready = bundles.filter((b) => b.state === 'review' && !!b.imageId).length;
  const blocked = bundles.filter((b) =>
    ['failed', 'uncertain', 'blocked_budget', 'waiting_material', 'stale'].includes(b.state),
  ).length;
  return `[Đạt Nguyễn · Marketing] ${day}\n${ready} bộ bài và ảnh chờ duyệt.\n${bundles.filter((b) => b.video && b.scriptApprovedRevision === null).length} kịch bản video chờ duyệt.\n${blocked} bộ cần xử lý.\n${bundles.length === 0 ? 'Chưa có nội dung từ kế hoạch đã duyệt.\n' : ''}${new URL('/marketing', required('MARKETING_ORIGIN')).href}`;
}
export async function sendDailyNotification(c: Context, day: string) {
  if (!marketingConfig().telegramEnabled) throw new Error('marketing_send_disabled');
  const ref = collection(c, 'marketingNotifications').doc(day);
  const locked = await c.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref),
      value = snap.data();
    if (value?.retryAfterUntil > Date.now()) throw new Error('marketing_delivery_rate_limited');
    if (value?.state === 'sent' || value?.state === 'uncertain') return false;
    if (value?.state === 'sending') {
      if (value.leaseUntil < Date.now())
        tx.update(ref, { state: 'uncertain', updatedAt: new Date().toISOString() });
      return false;
    }
    tx.set(ref, {
      state: 'sending',
      leaseUntil: Date.now() + 120000,
      updatedAt: new Date().toISOString(),
    });
    return true;
  });
  if (!locked) return { state: 'already_claimed' };
  let sendStarted = false;
  try {
    const docs = await collection(c, 'marketingBundles').where('date', '==', day).limit(12).get();
    const bundles = docs.docs.map((x) => x.data() as Bundle);
    const text = notificationText(day, bundles);
    sendStarted = true;
    const messageId = await telegramSender(
      required('TELEGRAM_BOT_TOKEN'),
      required('TELEGRAM_CHAT_ID'),
    )(text);
    await ref.update({ state: 'sent', messageId, updatedAt: new Date().toISOString() });
    return { state: 'sent' };
  } catch (error) {
    const uncertain = sendStarted && (!(error instanceof TelegramDeliveryError) || error.uncertain);
    await ref.update({
      state: uncertain ? 'uncertain' : 'failed',
      retryAfterUntil:
        error instanceof TelegramDeliveryError ? Date.now() + error.retryAfterSeconds * 1000 : 0,
      updatedAt: new Date().toISOString(),
    });
    throw new Error(uncertain ? 'marketing_delivery_uncertain' : 'marketing_delivery_failed');
  }
}
export async function scheduleHandler(request: Request, kind: 'prepare' | 'notify') {
  try {
    const time = await scheduleAuth(request, kind),
      cfg = marketingConfig();
    if (!cfg.enabled || !cfg.scheduleEnabled) throw new Error('marketing_schedule_disabled');
    const c = await ownerContext();
    if (kind === 'prepare') return response(await prepareDay(c, nextDay(businessDay(time))));
    if (cfg.generationEnabled) await flushOutbox(c).catch(() => undefined);
    return response(await sendDailyNotification(c, businessDay(time)));
  } catch (e) {
    return errorResponse(e);
  }
}
