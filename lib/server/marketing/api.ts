import 'server-only';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  brandSchema,
  idSchema,
  monthSchema,
  services,
  type Brand,
  type Plan,
  type Bundle,
  type PlanItem,
  type Asset,
} from '../../marketing/types';
import {
  initialBrand,
  calendarSlots,
  businessDay,
  canApprove,
  editBundle,
} from '../../marketing/domain';
import { MONTHLY_LIMIT } from '../../marketing/pricing';
import { caps } from '../../marketing/pricing';
import { scriptScenes } from '../../marketing/media';
import { requireOwner } from './auth';
import { collection, read, list, putJob, revise, type Context } from './store';
import { marketingReadiness, requireGeneration } from './config';
import { readBudget } from '../ai-settings/budget';
import { flushOutbox } from './tasks';
import { assetUrl, bucket } from './assets';

const revision = z.number().int().nonnegative();
const itemSchema = z
  .object({
    id: idSchema,
    date: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),
    service: z.enum(services),
    title: z.string().trim().max(180),
    video: z.boolean(),
    approved: z.boolean().optional(),
  })
  .strict();
export function response(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function requestBody(r: Request) {
  const text = await r.text();
  if (Buffer.byteLength(text) > 100000) throw new Error('marketing_request_too_large');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('marketing_input_invalid');
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return response({ error: 'marketing_input_invalid' }, 422);
  const firebaseErrors: Record<string, string> = {
    firebase_server_identity_missing: 'marketing_firebase_admin_missing',
    firebase_server_identity_invalid: 'marketing_firebase_admin_invalid',
    firebase_server_project_missing: 'marketing_firebase_project_missing',
    firebase_server_project_mismatch: 'marketing_firebase_project_mismatch',
  };
  const configuredError = error instanceof Error ? firebaseErrors[error.message] : undefined;
  const code =
    configuredError ??
    (error instanceof Error && /^marketing_[a-z_]+$/.test(error.message)
      ? error.message
      : 'marketing_server_unavailable');
  const status =
    code === 'marketing_unauthorized'
      ? 401
      : code === 'marketing_forbidden'
        ? 403
        : code === 'marketing_not_found'
          ? 404
          : code.endsWith('_conflict')
            ? 409
            : !configuredError && (code.includes('invalid') || code.includes('too_large'))
              ? 422
              : 503;
  return response({ error: code }, status);
}
async function enqueue(
  c: Context,
  b: Bundle,
  stage: 'draft' | 'image' | 'speech' | 'render' | 'export',
) {
  await requireGeneration(c, stage);
  const ref = collection(c, 'marketingBundles').doc(b.id);
  await c.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref),
      value = snap.data() as Bundle;
    if (!value || value.revision !== b.revision) throw new Error('marketing_revision_conflict');
    if (value.state === 'running' || value.state === 'queued' || value.state === 'uncertain')
      throw new Error('marketing_job_conflict');
    putJob(tx, c, b.id, b.revision, stage);
    tx.update(ref, { state: 'queued', error: '', updatedAt: new Date().toISOString() });
  });
  await flushOutbox(c).catch(() => undefined); // Durable outbox remains visible and is reconciled by scheduled invocations.
}
function blank(item: PlanItem, plan: Plan): Bundle {
  return {
    id: item.id,
    itemId: item.id,
    planId: plan.id,
    planRevision: plan.revision,
    brandRevision: plan.brandRevision ?? 0,
    date: item.date,
    service: item.service,
    video: item.video,
    title: item.title,
    revision: 0,
    scriptRevision: 0,
    scriptApprovedRevision: null,
    approvedRevision: null,
    captions: { facebook: '', zalo: '', tiktok: '', youtube: '' },
    imagePrompt: '',
    script: '',
    scenes: [],
    claims: [],
    style: 'knowledge',
    imageId: null,
    audioId: null,
    videoId: null,
    exportId: null,
    recordingId: null,
    state: 'empty',
    error: '',
    updatedAt: new Date().toISOString(),
  };
}
export async function createDailyBundle(c: Context, item: PlanItem, plan: Plan) {
  const ref = collection(c, 'marketingBundles').doc(item.id);
  await c.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;
    const p = await tx.get(collection(c, 'marketingPlans').doc(plan.id));
    if (!p.data()?.approved || p.data()?.revision !== plan.revision)
      throw new Error('marketing_revision_conflict');
    tx.create(ref, { ...blank(item, plan), state: 'queued' });
    putJob(tx, c, item.id, 0, 'draft');
  });
}
export async function handleMarketing(request: Request, path: string[]) {
  try {
    const c = await requireOwner(request),
      method = request.method;
    const [part, id, action] = path;
    if (id) idSchema.parse(id);
    if (part === 'status' && method === 'GET') return response(await marketingReadiness(c));
    if (part === 'dashboard' && method === 'GET') {
      const month = monthSchema.parse(
        new URL(request.url).searchParams.get('month') ?? businessDay().slice(0, 7),
      );
      const [brand, plans, bundles, budget, jobs] = await Promise.all([
        read<Brand>(c, 'marketingBrand', 'profile'),
        read<Plan>(c, 'marketingPlans', month).then((p) => (p ? [p] : [])),
        collection(c, 'marketingBundles')
          .where('date', '>=', month + '-01')
          .where('date', '<=', month + '-31')
          .orderBy('date', 'desc')
          .limit(90)
          .get()
          .then((s) => s.docs.map((d) => ({ ...d.data(), id: d.id }) as Bundle)),
        readBudget(c),
        list(c, 'marketingJobs', 20),
      ]);
      return response({
        brand: brandSchema.strip().parse(brand ?? initialBrand()),
        plans,
        bundles,
        budget: budget ?? { spent: 0, reserved: 0, limit: MONTHLY_LIMIT },
        jobs,
        status: await marketingReadiness(c),
      });
    }
    if (part === 'brand') {
      if (method === 'GET')
        return response(
          brandSchema.strip().parse((await read(c, 'marketingBrand', 'profile')) ?? initialBrand()),
        );
      if (method === 'PATCH') {
        const value = brandSchema.parse(await requestBody(request)),
          ref = collection(c, 'marketingBrand').doc('profile');
        await c.db.runTransaction(async (tx) => {
          const snap = await tx.get(ref),
            old = snap.data();
          if ((old?.revision ?? 0) !== value.revision)
            throw new Error('marketing_revision_conflict');
          tx.set(ref, {
            ...value,
            revision: value.revision + 1,
            updatedAt: new Date().toISOString(),
          });
        });
        return response({ ok: true, brand: { ...value, revision: value.revision + 1 } });
      }
    }
    if (part === 'plans' && !id && method === 'POST') {
      const body = z
        .object({ month: monthSchema })
        .strict()
        .parse(await requestBody(request));
      const plan: Plan = {
        id: body.month,
        month: body.month,
        items: calendarSlots(body.month),
        revision: 0,
        approved: false,
        state: 'draft',
        error: '',
      };
      await collection(c, 'marketingPlans')
        .doc(plan.id)
        .create({ ...plan, updatedAt: new Date().toISOString() })
        .catch(() => {
          throw new Error('marketing_plan_conflict');
        });
      return response(plan, 201);
    }
    if (part === 'plans' && id) {
      const body = method === 'GET' ? {} : await requestBody(request);
      if (method === 'PATCH') {
        const v = z
          .object({ revision, items: z.array(itemSchema).length(90) })
          .strict()
          .parse(body);
        const existing = await read<Plan>(c, 'marketingPlans', id);
        if (!existing) throw new Error('marketing_not_found');
        const expected = new Set(calendarSlots(existing.month).map((x) => x.id));
        if (
          new Set(v.items.map((x) => x.id)).size !== 90 ||
          v.items.some(
            (x) =>
              !expected.has(x.id) ||
              !calendarSlots(existing.month).some(
                (y) => y.id === x.id && y.service === x.service,
              ) ||
              !x.date.startsWith(existing.month) ||
              businessDay(new Date(x.date + 'T00:00:00Z')) !== x.date,
          ) ||
          services.some((s) => v.items.filter((x) => x.service === s && x.video).length !== 15)
        )
          throw new Error('marketing_input_invalid');
        await revise<Plan>(c, 'marketingPlans', id, v.revision, () => ({
          items: v.items.map((i) => ({ ...i, approved: false })),
          revision: v.revision + 1,
          approved: false,
          state: 'draft',
        }));
        return response({ ok: true });
      }
      if (method === 'POST' && action === 'approve') {
        const v = z
            .object({ revision, itemIds: z.array(idSchema).min(1).max(90).optional() })
            .strict()
            .parse(body),
          planRef = collection(c, 'marketingPlans').doc(id);
        await c.db.runTransaction(async (tx) => {
          const [snap, profile] = await Promise.all([
            tx.get(planRef),
            tx.get(collection(c, 'marketingBrand').doc('profile')),
          ]);
          const p = snap.data() as Plan | undefined,
            brand = profile.data() as Brand | undefined;
          if (!p || p.revision !== v.revision) throw new Error('marketing_revision_conflict');
          if (!brand?.approved) throw new Error('marketing_brand_not_approved');
          const chosen = new Set(v.itemIds ?? p.items.map((i) => i.id));
          if (
            p.state === 'queued' ||
            p.state === 'running' ||
            [...chosen].some((key) => !p.items.some((i) => i.id === key && i.title.trim()))
          )
            throw new Error('marketing_plan_incomplete');
          const brandChanged = p.brandRevision !== undefined && p.brandRevision !== brand.revision;
          tx.update(planRef, {
            approved: true,
            revision: p.revision + (brandChanged ? 1 : 0),
            brandRevision: brand.revision,
            updatedAt: new Date().toISOString(),
            items: p.items.map((i) => ({
              ...i,
              approved: chosen.has(i.id) || (!brandChanged && (i.approved ?? p.approved)),
            })),
          });
          tx.create(collection(c, 'marketingApprovals').doc(randomUUID()), {
            kind: 'plan',
            planId: id,
            revision: p.revision + (brandChanged ? 1 : 0),
            brandRevision: brand.revision,
            itemIds: [...chosen],
            uid: c.uid,
            updatedAt: new Date().toISOString(),
          });
        });
        return response({ ok: true });
      }
      if (method === 'POST' && action === 'generate') {
        await requireGeneration(c, 'plan');
        const v = z.object({ revision }).strict().parse(body),
          ref = collection(c, 'marketingPlans').doc(id);
        await c.db.runTransaction(async (tx) => {
          const snap = await tx.get(ref),
            p = snap.data() as Plan;
          if (
            !p ||
            p.revision !== v.revision ||
            p.state === 'running' ||
            p.state === 'queued' ||
            p.state === 'uncertain'
          )
            throw new Error('marketing_revision_conflict');
          const brand = await tx.get(collection(c, 'marketingBrand').doc('profile'));
          if (!brand.data()?.approved) throw new Error('marketing_brand_not_approved');
          const next = p.revision + 1;
          tx.update(ref, {
            revision: next,
            approved: false,
            state: 'queued',
            updatedAt: new Date().toISOString(),
          });
          putJob(tx, c, id, next, 'plan');
        });
        await flushOutbox(c).catch(() => undefined);
        return response({ queued: true }, 202);
      }
    }
    if (part === 'bundles' && id) {
      const bundle = await read<Bundle>(c, 'marketingBundles', id);
      if (!bundle) throw new Error('marketing_not_found');
      if (method === 'GET' && !action) return response(bundle);
      const body = method === 'GET' ? {} : await requestBody(request);
      if (method === 'PATCH') {
        const v = z
          .object({
            revision,
            channel: z.enum(['facebook', 'zalo', 'tiktok', 'youtube']).optional(),
            text: z.string().min(1).max(7000).optional(),
            script: z.string().min(1).max(1800).optional(),
            claims: z
              .array(
                z
                  .object({
                    text: z.string().max(1000),
                    source: z.string().max(2000),
                    verified: z.boolean(),
                  })
                  .strict()
                  .refine((x) => !x.verified || x.source.trim().length > 0),
              )
              .max(20)
              .optional(),
            recordingId: idSchema.optional(),
          })
          .strict()
          .parse(body);
        if (v.recordingId) {
          const a = await read<Asset>(c, 'marketingAssets', v.recordingId);
          if (!a?.verified || a.kind !== 'recording' || a.bundleId !== id)
            throw new Error('marketing_asset_unavailable');
        }
        await revise<Bundle>(c, 'marketingBundles', id, v.revision, (b) => {
          if (b.state === 'running' || b.state === 'queued' || b.state === 'uncertain')
            throw new Error('marketing_job_conflict');
          const kind = v.script || v.recordingId ? 'script' : 'caption',
            next = editBundle(b, kind);
          return {
            ...next,
            exportId: null,
            state: 'review',
            ...(v.channel && v.text ? { captions: { ...b.captions, [v.channel]: v.text } } : {}),
            ...(v.script
              ? {
                  script: v.script,
                  scenes: scriptScenes(v.script),
                  audioId: null,
                  scriptRevision: b.scriptRevision + 1,
                }
              : {}),
            ...(v.claims ? { claims: v.claims } : {}),
            ...(v.recordingId
              ? {
                  recordingId: v.recordingId,
                  style: 'tutorial',
                  scriptRevision: b.scriptRevision + 1,
                  audioId: null,
                }
              : {}),
          };
        });
        return response({ ok: true });
      }
      if (method === 'POST' && action === 'approve-script') {
        await requireGeneration(c, 'speech');
        const v = z.object({ revision }).strict().parse(body),
          ref = collection(c, 'marketingBundles').doc(id);
        await c.db.runTransaction(async (tx) => {
          const snap = await tx.get(ref),
            b = snap.data() as Bundle;
          if (
            !b ||
            b.revision !== v.revision ||
            b.state === 'queued' ||
            b.state === 'running' ||
            b.state === 'uncertain'
          )
            throw new Error('marketing_revision_conflict');
          if (
            !b.video ||
            !b.script ||
            !b.scenes.length ||
            b.claims.some((x) => !x.verified) ||
            (b.style === 'tutorial' && !b.recordingId)
          )
            throw new Error('marketing_script_incomplete');
          const next = b.revision + 1;
          tx.update(ref, {
            revision: next,
            scriptApprovedRevision: b.scriptRevision,
            approvedRevision: null,
            exportId: null,
            state: 'queued',
            updatedAt: new Date().toISOString(),
          });
          putJob(tx, c, id, next, 'speech');
          tx.create(collection(c, 'marketingApprovals').doc(randomUUID()), {
            kind: 'script',
            bundleId: id,
            revision: next,
            uid: c.uid,
            updatedAt: new Date().toISOString(),
          });
        });
        await flushOutbox(c).catch(() => undefined);
        return response({ queued: true }, 202);
      }
      if (method === 'POST' && action === 'approve') {
        const v = z.object({ revision }).strict().parse(body);
        await c.db.runTransaction(async (tx) => {
          const ref = collection(c, 'marketingBundles').doc(id),
            snap = await tx.get(ref),
            b = snap.data() as Bundle;
          if (b.revision !== v.revision) throw new Error('marketing_revision_conflict');
          const plan = await tx.get(collection(c, 'marketingPlans').doc(b.planId));
          const brand = await tx.get(collection(c, 'marketingBrand').doc('profile'));
          if (!brand.data()?.approved || brand.data()?.revision !== b.brandRevision)
            throw new Error('marketing_brand_changed');
          if (!plan.data()?.approved || plan.data()?.revision !== b.planRevision)
            throw new Error('marketing_plan_changed');
          if (
            !canApprove(b) ||
            b.state !== 'review' ||
            (b.video && b.scriptApprovedRevision !== b.scriptRevision)
          )
            throw new Error('marketing_approval_incomplete');
          tx.update(ref, { approvedRevision: b.revision, updatedAt: new Date().toISOString() });
          tx.create(collection(c, 'marketingApprovals').doc(randomUUID()), {
            kind: 'final',
            bundleId: id,
            revision: b.revision,
            uid: c.uid,
            updatedAt: new Date().toISOString(),
          });
        });
        return response({ ok: true });
      }
      if (method === 'POST' && action === 'generate') {
        const v = z.object({ revision }).strict().parse(body);
        if (v.revision !== bundle.revision) throw new Error('marketing_revision_conflict');
        if (bundle.state !== 'empty') throw new Error('marketing_job_conflict');
        await enqueue(c, bundle, 'draft');
        return response({ queued: true }, 202);
      }
      if (method === 'POST' && action === 'rebase') {
        await requireGeneration(c, 'draft');
        const v = z.object({ revision }).strict().parse(body),
          ref = collection(c, 'marketingBundles').doc(id);
        await c.db.runTransaction(async (tx) => {
          const [snap, p] = await Promise.all([
            tx.get(ref),
            tx.get(collection(c, 'marketingPlans').doc(bundle.planId)),
          ]);
          const b = snap.data() as Bundle,
            plan = p.data() as Plan | undefined;
          if (
            !b ||
            b.revision !== v.revision ||
            !['stale', 'review', 'failed', 'blocked_budget'].includes(b.state) ||
            !plan?.approved ||
            plan.revision === b.planRevision
          )
            throw new Error('marketing_revision_conflict');
          const item = plan.items.find((i) => i.id === b.itemId && (i.approved ?? plan.approved));
          if (!item) throw new Error('marketing_plan_not_approved');
          const next = {
            ...blank(item, { ...plan, id: bundle.planId }),
            revision: b.revision + 1,
            state: 'queued',
          };
          tx.set(ref, next);
          putJob(tx, c, id, next.revision, 'draft');
        });
        await flushOutbox(c).catch(() => undefined);
        return response({ queued: true }, 202);
      }
      if (method === 'POST' && action === 'retry') {
        const v = z.object({ revision }).strict().parse(body);
        const jobs = await collection(c, 'marketingJobs')
          .where('bundleId', '==', id)
          .limit(30)
          .get();
        const job = jobs.docs.find(
          (x) =>
            x.data().revision === v.revision &&
            ['failed', 'blocked_budget', 'waiting_material'].includes(x.data().state),
        );
        if (!job) throw new Error('marketing_job_conflict');
        await requireGeneration(c, job.data().stage);
        await c.db.runTransaction(async (tx) => {
          const [j, b, cost] = await Promise.all([
            tx.get(job.ref),
            tx.get(collection(c, 'marketingBundles').doc(id)),
            tx.get(collection(c, 'marketingCosts').doc(job.id)),
          ]);
          const value = j.data() as import('../../marketing/types').Job;
          if (
            b.data()?.revision !== v.revision ||
            !['failed', 'blocked_budget', 'waiting_material'].includes(value.state) ||
            value.attempts >= 3 ||
            (value.sideEffect && caps[value.stage] > 0) ||
            (cost.exists && !['released', 'reserved'].includes(cost.data()?.state))
          )
            throw new Error('marketing_job_conflict');
          tx.update(job.ref, {
            state: 'queued',
            sideEffect: false,
            execution: null,
            error: '',
            updatedAt: new Date().toISOString(),
          });
          tx.update(collection(c, 'marketingBundles').doc(id), {
            state: 'queued',
            error: '',
            updatedAt: new Date().toISOString(),
          });
          tx.set(collection(c, 'marketingOutbox').doc(job.id), {
            id: job.id,
            state: 'pending',
            updatedAt: new Date().toISOString(),
          });
        });
        // Cloud Tasks retains task names after completion, so retry uses an explicit attempt suffix.
        await flushOutbox(c).catch(() => undefined);
        return response({ queued: true }, 202);
      }
      if (method === 'POST' && action === 'export') {
        const v = z.object({ revision }).strict().parse(body);
        if (v.revision !== bundle.revision) throw new Error('marketing_revision_conflict');
        if (bundle.approvedRevision !== bundle.revision)
          throw new Error('marketing_approval_incomplete');
        const profile = await read<Brand>(c, 'marketingBrand', 'profile');
        if (!profile?.approved || profile.revision !== bundle.brandRevision)
          throw new Error('marketing_brand_changed');
        if (bundle.exportId) return response({ url: await assetUrl(c, bundle.exportId) });
        await enqueue(c, bundle, 'export');
        return response({ queued: true }, 202);
      }
    }
    if (part === 'assets' && id && action === 'download' && method === 'GET') {
      const a = await read<Asset>(c, 'marketingAssets', id);
      if (!a) throw new Error('marketing_not_found');
      if (a.kind === 'export') {
        const b = await read<Bundle>(c, 'marketingBundles', a.bundleId);
        if (!b || b.exportId !== id || b.approvedRevision !== b.revision)
          throw new Error('marketing_approval_incomplete');
        const profile = await read<Brand>(c, 'marketingBrand', 'profile');
        if (!profile?.approved || profile.revision !== b.brandRevision)
          throw new Error('marketing_brand_changed');
      }
      return response({ url: await assetUrl(c, id) });
    }
    if (part === 'assets' && id === 'upload' && method === 'POST') {
      const v = z
        .object({
          bundleId: idSchema,
          contentType: z.enum(['image/png', 'image/jpeg', 'video/mp4']),
          size: z.number().int().positive().max(200000000),
          rightsConfirmed: z.literal(true),
        })
        .strict()
        .parse(await requestBody(request));
      if (v.contentType !== 'video/mp4' && v.size > 10000000)
        throw new Error('marketing_asset_too_large');
      const b = await read(c, 'marketingBundles', v.bundleId);
      if (!b) throw new Error('marketing_not_found');
      const assetId = randomUUID(),
        key = `marketing/${c.uid}/${v.bundleId}/${assetId}`;
      const url = (
        await bucket()
          .file(key)
          .getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 600000,
            contentType: v.contentType,
          })
      )[0];
      await collection(c, 'marketingAssets')
        .doc(assetId)
        .create({
          id: assetId,
          key,
          kind: v.contentType === 'video/mp4' ? 'recording' : 'image',
          contentType: v.contentType,
          size: v.size,
          bundleId: v.bundleId,
          verified: false,
          revision: 0,
          state: 'uploaded',
          rightsConfirmed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      return response({ id: assetId, url });
    }
    // Upload finalization is deliberately not trusted from client metadata: the worker probes it before use.
    if (part === 'assets' && id && action === 'finalize' && method === 'POST') {
      await requireGeneration(c, 'probe');
      const ref = collection(c, 'marketingAssets').doc(id);
      await c.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('marketing_not_found');
        if (snap.data()?.state !== 'uploaded') throw new Error('marketing_job_conflict');
        tx.update(ref, { state: 'queued', updatedAt: new Date().toISOString() });
        putJob(tx, c, id, 0, 'probe');
      });
      await flushOutbox(c).catch(() => undefined);
      return response({ queued: true }, 202);
    }
    if (part === 'assets' && id && !action && method === 'GET') {
      const a = await read(c, 'marketingAssets', id);
      if (!a) throw new Error('marketing_not_found');
      return response(a);
    }
    if (part === 'outbox' && method === 'POST') {
      await requireGeneration(c, 'export');
      return response(await flushOutbox(c));
    }
    if (part === 'prepare-today' && method === 'POST') {
      const { prepareDay } = await import('./daily');
      return response(await prepareDay(c, businessDay()));
    }
    return response({ error: 'marketing_not_found' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
