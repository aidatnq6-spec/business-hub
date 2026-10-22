import { z } from 'zod';
export const services = ['signature', 'ai-training', 'investment-training'] as const;
export const channels = ['facebook', 'zalo', 'tiktok', 'youtube'] as const;
export const serviceLabels = {
  signature: 'Chữ ký số',
  'ai-training': 'Đào tạo AI',
  'investment-training': 'Đào tạo đầu tư',
};
export const channelLabels = {
  facebook: 'Facebook',
  zalo: 'Zalo',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const monthSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export const serviceSchema = z.enum(services);
export const claimSchema = z
  .object({ text: z.string().max(1000), source: z.string().max(2000), verified: z.boolean() })
  .strict();
export const brandSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    contact: z.string().max(500),
    tone: z.string().max(500),
    description: z.string().max(12000),
    approved: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const sceneSchema = z.object({ text: z.string().min(1).max(200) }).strict();
export const draftSchema = z
  .object({
    title: z.string().min(1).max(180),
    captions: z
      .object({
        facebook: z.string().min(1).max(7000),
        zalo: z.string().min(1).max(7000),
        tiktok: z.string().min(1).max(7000),
        youtube: z.string().min(1).max(7000),
      })
      .strict(),
    imagePrompt: z.string().min(1).max(2000),
    script: z.string().max(1800),
    scenes: z.array(sceneSchema).max(12),
    claims: z.array(claimSchema).max(20),
    style: z.enum(['knowledge', 'tutorial']),
  })
  .strict();
export type Service = (typeof services)[number];
export type Channel = (typeof channels)[number];
export type Brand = z.infer<typeof brandSchema>;
export type Draft = z.infer<typeof draftSchema>;
export interface PlanItem {
  id: string;
  date: string;
  service: Service;
  title: string;
  video: boolean;
  approved?: boolean;
}
export interface Plan {
  id: string;
  month: string;
  revision: number;
  approved: boolean;
  items: PlanItem[];
  state?: string;
  error?: string;
  brandRevision?: number;
}
export type Stage = 'plan' | 'draft' | 'image' | 'speech' | 'render' | 'export' | 'probe';
export interface Bundle extends Draft {
  id: string;
  itemId: string;
  planId: string;
  planRevision: number;
  brandRevision: number;
  date: string;
  service: Service;
  video: boolean;
  revision: number;
  scriptRevision: number;
  scriptApprovedRevision: number | null;
  approvedRevision: number | null;
  imageId: string | null;
  audioId: string | null;
  videoId: string | null;
  exportId: string | null;
  recordingId: string | null;
  subtitleId?: string | null;
  state: string;
  error: string;
  updatedAt: string;
}
export interface Job {
  id: string;
  bundleId: string;
  revision: number;
  stage: Stage;
  state: string;
  attempts: number;
  leaseUntil: number;
  sideEffect: boolean;
  error: string;
  createdAt: string;
}
export interface Asset {
  id: string;
  key: string;
  kind: 'image' | 'audio' | 'video' | 'recording' | 'export' | 'subtitle';
  contentType: string;
  size: number;
  verified: boolean;
  bundleId: string;
  createdAt: string;
  revision?: number;
  sha256?: string;
}
export interface Budget {
  spent: number;
  reserved: number;
  limit: number;
}
