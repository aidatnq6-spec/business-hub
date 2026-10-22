import 'server-only';
import { getStorage } from 'firebase-admin/storage';
import { getApp } from 'firebase-admin/app';
import { firebaseAdmin } from '../firebase-admin';
import { randomUUID, createHash } from 'node:crypto';
import { required } from './config';
import { collection, type Context, read } from './store';
import type { Asset } from '../../marketing/types';
export function bucket() {
  firebaseAdmin();
  return getStorage(getApp('business-hub-server')).bucket(required('MARKETING_BUCKET'));
}
// getStorage() needs the named Firebase app, not an implicitly initialized default app.
export async function saveAsset(
  c: Context,
  bundleId: string,
  kind: Asset['kind'],
  contentType: string,
  data: Buffer,
) {
  const id = randomUUID(),
    key = `marketing/${c.uid}/${bundleId}/${id}`;
  await bucket()
    .file(key)
    .save(data, { resumable: false, metadata: { contentType, cacheControl: 'private, no-store' } });
  const asset: Asset = {
    id,
    key,
    kind,
    contentType,
    size: data.length,
    verified: true,
    bundleId,
    createdAt: new Date().toISOString(),
    sha256: createHash('sha256').update(data).digest('hex'),
  };
  await collection(c, 'marketingAssets')
    .doc(id)
    .set({ ...asset, updatedAt: asset.createdAt });
  return id;
}
export async function assetRecord(c: Context, id: string) {
  const a = await read<Asset>(c, 'marketingAssets', id);
  if (!a || !a.key.startsWith(`marketing/${c.uid}/`) || !a.verified)
    throw new Error('marketing_asset_unavailable');
  return a;
}
export async function assetData(c: Context, id: string) {
  const a = await assetRecord(c, id);
  if (a.size > 210_000_000) throw new Error('marketing_asset_too_large');
  const [data] = await bucket().file(a.key).download({ start: 0, end: a.size });
  if (
    data.length !== a.size ||
    !a.sha256 ||
    createHash('sha256').update(data).digest('hex') !== a.sha256
  )
    throw new Error('marketing_material_changed');
  return { asset: a, data };
}
export async function assetUrl(c: Context, id: string) {
  const a = await assetRecord(c, id);
  return (
    await bucket()
      .file(a.key)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 5 * 60000,
        responseDisposition: `attachment; filename="dat-nguyen-${id}.${a.kind === 'video' ? 'mp4' : a.kind === 'export' ? 'zip' : a.kind === 'image' ? 'png' : 'wav'}"`,
      })
  )[0];
}
