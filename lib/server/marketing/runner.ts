import 'server-only';
import { createHash } from 'node:crypto';
import { draftContent, proposePlan, createImage, speak } from './providers';
import { caps } from '../../marketing/pricing';
import { channels, type Bundle, type Brand, type Job, type Plan } from '../../marketing/types';
import { assetData, saveAsset } from './assets';
import { collection, read, reserve, settle, putJob, type Context } from './store';
import { requireGeneration } from './config';
import { flushOutbox } from './tasks';
import { zipFiles } from '../../marketing/zip';

export interface RenderInput {
  brandName?: string;
  bundle: Bundle;
  image: Buffer;
  audio: { text: string; data: Buffer }[];
  recording?: Buffer;
}
export type Renderer = (input: RenderInput) => Promise<{ video: Buffer; srt: string }>;
export async function runJob(
  c: Context,
  id: string,
  renderer: Renderer,
  probe: (data: Buffer, contentType: string) => Promise<void>,
  composeImage: (data: Buffer, title: string, brandName: string) => Promise<Buffer> = async (
    data,
  ) => data,
) {
  requireGeneration();
  const ref = collection(c, 'marketingJobs').doc(id);
  const job = await c.db.runTransaction(async (tx) => {
    const s = await tx.get(ref),
      j = s.data() as Job | undefined;
    if (!j) throw new Error('marketing_not_found');
    if (
      ['succeeded', 'uncertain', 'failed', 'stale', 'cancelled', 'blocked_budget'].includes(j.state)
    )
      return null;
    if (j.state === 'running') {
      if (j.leaseUntil > Date.now()) throw new Error('marketing_job_busy');
      if (j.sideEffect && caps[j.stage] > 0) {
        const targetName = j.stage === 'plan' ? 'marketingPlans' : 'marketingBundles';
        const targetRef = collection(c, targetName).doc(j.bundleId),
          targetSnap = await tx.get(targetRef);
        tx.update(ref, { state: 'uncertain', error: 'marketing_interrupted_after_provider' });
        if (targetSnap.data()?.revision === j.revision)
          tx.update(targetRef, {
            state: 'uncertain',
            error: 'marketing_interrupted_after_provider',
            updatedAt: new Date().toISOString(),
          });
        return null;
      }
    }
    if (j.attempts >= 3) {
      tx.update(ref, { state: 'failed', error: 'marketing_attempt_limit' });
      return null;
    }
    tx.update(ref, {
      state: 'running',
      attempts: j.attempts + 1,
      leaseUntil: Date.now() + 16 * 60000,
      updatedAt: new Date().toISOString(),
    });
    return j;
  });
  if (!job) return { state: 'already_processed' };
  const name =
      job.stage === 'probe'
        ? 'marketingAssets'
        : job.stage === 'plan'
          ? 'marketingPlans'
          : 'marketingBundles',
    target = collection(c, name).doc(job.bundleId);
  let sideEffect = false;
  try {
    if (job.stage === 'probe') {
      const { bucket } = await import('./assets');
      const asset = await read<import('../../marketing/types').Asset>(
        c,
        'marketingAssets',
        job.bundleId,
      );
      if (!asset || !asset.key.startsWith(`marketing/${c.uid}/`))
        throw new Error('marketing_forbidden');
      const file = bucket().file(asset.key),
        [meta] = await file.getMetadata();
      if (
        Number(meta.size) !== asset.size ||
        Number(meta.size) > 200000000 ||
        meta.contentType !== asset.contentType
      )
        throw new Error('marketing_material_invalid');
      const [bytes] = await file.download({ start: 0, end: asset.size });
      if (bytes.length !== asset.size) throw new Error('marketing_material_changed');
      await probe(bytes, asset.contentType);
      await target.update({
        verified: true,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        state: 'verified',
        updatedAt: new Date().toISOString(),
      });
      await ref.update({ state: 'succeeded', updatedAt: new Date().toISOString() });
      return { state: 'succeeded' };
    }
    const value = await read<Bundle | Plan>(c, name, job.bundleId);
    if (!value || value.revision !== job.revision) throw new Error('marketing_stale');
    const brand = await read<Brand>(c, 'marketingBrand', 'profile');
    if (!brand?.approved) throw new Error('marketing_brand_not_approved');
    if (job.stage !== 'plan') {
      const b = value as Bundle,
        p = await read<Plan>(c, 'marketingPlans', b.planId);
      if (brand.revision !== b.brandRevision) throw new Error('marketing_stale');
      if (
        !p?.approved ||
        p.revision !== b.planRevision ||
        !p.items.some((i) => i.id === b.itemId && (i.approved ?? p.approved))
      )
        throw new Error('marketing_stale');
      if (
        ['speech', 'render'].includes(job.stage) &&
        (b.scriptApprovedRevision !== b.scriptRevision || b.claims.some((x) => !x.verified))
      )
        throw new Error('marketing_script_incomplete');
      if (b.style === 'tutorial' && !b.recordingId && ['speech', 'render'].includes(job.stage))
        throw new Error('marketing_material_missing');
    }
    await reserve(c, job);
    await c.db.runTransaction(async (tx) => {
      const snap = await tx.get(target);
      if (snap.data()?.revision !== job.revision) throw new Error('marketing_stale');
      const profile = await tx.get(collection(c, 'marketingBrand').doc('profile'));
      if (!profile.data()?.approved || profile.data()?.revision !== brand.revision)
        throw new Error('marketing_stale');
      if (job.stage !== 'plan') {
        const p = await tx.get(collection(c, 'marketingPlans').doc((value as Bundle).planId));
        if (!p.data()?.approved || p.data()?.revision !== (value as Bundle).planRevision)
          throw new Error('marketing_stale');
      }
      tx.update(ref, { sideEffect: true });
      tx.update(target, { state: 'running', updatedAt: new Date().toISOString() });
    });
    sideEffect = true;
    let patch: Record<string, unknown> = {},
      cost: number | null = 0,
      next: Job['stage'] | null = null;
    if (job.stage === 'plan') {
      const r = await proposePlan(value as Plan, brand);
      patch = { items: r.items, approved: false, state: 'draft' };
      cost = r.cost;
    } else {
      const b = value as Bundle;
      if (job.stage === 'draft') {
        const r = await draftContent(b, brand);
        patch = {
          ...r.draft,
          state: 'queued',
          scriptRevision: b.scriptRevision + 1,
          approvedRevision: null,
        };
        cost = r.cost;
        next = 'image';
      } else if (job.stage === 'image') {
        const r = await createImage(b.imagePrompt);
        const branded = await composeImage(r.buffer, b.title, brand.name);
        const imageId = await saveAsset(c, b.id, 'image', 'image/png', branded);
        patch = { imageId, state: 'review' };
        cost = r.cost;
      } else if (job.stage === 'speech') {
        const scenes = b.scenes;
        if (!scenes.length || scenes.map((x) => x.text).join('').length > 1800)
          throw new Error('marketing_script_invalid');
        const audio = [];
        for (const scene of scenes) {
          const wave = await speak(scene.text);
          audio.push({
            text: scene.text,
            id: await saveAsset(c, b.id, 'audio', 'audio/wav', wave),
          });
        }
        const audioId = await saveAsset(
          c,
          b.id,
          'audio',
          'application/json',
          Buffer.from(JSON.stringify(audio)),
        );
        patch = { audioId, state: 'queued' };
        cost = Math.ceil(
          ((scenes.map((x) => [...x.text].length).reduce((a, b) => a + b, 0) * 16) / 1e6) *
            30000 *
            1.2,
        );
        next = 'render';
      } else if (job.stage === 'render') {
        if (!b.audioId || !b.imageId) throw new Error('marketing_material_missing');
        const manifest = JSON.parse((await assetData(c, b.audioId)).data.toString('utf8')) as {
          text: string;
          id: string;
        }[];
        if (!Array.isArray(manifest) || manifest.length > 12)
          throw new Error('marketing_material_invalid');
        const audio = [];
        for (const clip of manifest) {
          const a = await assetData(c, clip.id);
          if (a.asset.bundleId !== b.id) throw new Error('marketing_forbidden');
          audio.push({ text: clip.text, data: a.data });
        }
        const image = await assetData(c, b.imageId);
        if (image.asset.bundleId !== b.id) throw new Error('marketing_forbidden');
        const recording = b.recordingId ? await assetData(c, b.recordingId) : null;
        if (recording && recording.asset.bundleId !== b.id) throw new Error('marketing_forbidden');
        const result = await renderer({
          brandName: brand.name,
          bundle: b,
          image: image.data,
          audio,
          recording: recording?.data,
        });
        const videoId = await saveAsset(c, b.id, 'video', 'video/mp4', result.video);
        const subtitleId = await saveAsset(
          c,
          b.id,
          'subtitle',
          'text/plain',
          Buffer.from(result.srt),
        );
        patch = { videoId, subtitleId, state: 'review' };
      } else if (job.stage === 'export') {
        if (b.approvedRevision !== b.revision) throw new Error('marketing_approval_incomplete');
        const files: { name: string; data: Buffer }[] = channels.map((channel) => ({
          name: `${channel}.txt`,
          data: Buffer.from(b.captions[channel], 'utf8'),
        }));
        if (!b.imageId || (b.video && !b.videoId)) throw new Error('marketing_material_missing');
        const image = await assetData(c, b.imageId);
        files.push({
          name: image.asset.contentType === 'image/jpeg' ? 'image.jpg' : 'image.png',
          data: image.data,
        });
        if (b.videoId)
          files.push({ name: 'video.mp4', data: (await assetData(c, b.videoId)).data });
        if (b.subtitleId)
          files.push({ name: 'subtitles.srt', data: (await assetData(c, b.subtitleId)).data });
        files.push({
          name: 'manifest.json',
          data: Buffer.from(
            JSON.stringify(
              {
                brand: brand.name,
                revision: b.revision,
                title: b.title,
                date: b.date,
                claims: b.claims,
              },
              null,
              2,
            ),
          ),
        });
        const zip = zipFiles(files);
        if (zip.length > 150000000) throw new Error('marketing_asset_too_large');
        const exportId = await saveAsset(c, b.id, 'export', 'application/zip', zip);
        patch = { exportId, state: 'review' };
      }
    }
    const applied = await c.db.runTransaction(async (tx) => {
      const current = await tx.get(target),
        v = current.data();
      const profile = await tx.get(collection(c, 'marketingBrand').doc('profile'));
      const plan =
        job.stage === 'plan'
          ? null
          : await tx.get(collection(c, 'marketingPlans').doc((value as Bundle).planId));
      if (
        v?.revision !== job.revision ||
        !profile.data()?.approved ||
        profile.data()?.revision !== brand.revision ||
        (plan &&
          (!plan.data()?.approved || plan.data()?.revision !== (value as Bundle).planRevision))
      ) {
        tx.update(ref, { state: 'stale', updatedAt: new Date().toISOString() });
        if (v?.revision === job.revision)
          tx.update(target, { state: 'stale', updatedAt: new Date().toISOString() });
        return false;
      }
      tx.update(target, { ...patch, error: '', updatedAt: new Date().toISOString() });
      tx.update(ref, { state: 'succeeded', error: '', updatedAt: new Date().toISOString() });
      if (next) putJob(tx, c, job.bundleId, job.revision, next);
      return true;
    });
    // Unknown image token charges stay reserved and visible; never claim them reconciled.
    await settle(c, job, cost);
    await flushOutbox(c).catch(() => undefined);
    return { state: applied ? 'succeeded' : 'stale' };
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const state =
      raw === 'marketing_stale'
        ? 'stale'
        : raw === 'marketing_budget_exceeded'
          ? 'blocked_budget'
          : raw === 'marketing_material_missing'
            ? 'waiting_material'
            : sideEffect && caps[job.stage] > 0
              ? 'uncertain'
              : 'failed';
    const code = /^marketing_[a-z_]+$/.test(raw) ? raw : 'marketing_job_failed';
    await ref.update({ state, error: code, updatedAt: new Date().toISOString() });
    await c.db.runTransaction(async (tx) => {
      const s = await tx.get(target);
      if (s.data()?.revision === job.revision)
        tx.update(target, { state, error: code, updatedAt: new Date().toISOString() });
    });
    await settle(c, job, sideEffect ? null : 0);
    return { state };
  }
}
