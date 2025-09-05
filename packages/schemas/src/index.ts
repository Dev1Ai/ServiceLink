import { z } from 'zod';

export const ProviderStatusSchema = z.object({
  providerId: z.string(),
  online: z.boolean(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  at: z.string().datetime().optional()
});

export const JobIntakeSchema = z.object({
  categorySlug: z.string(),
  description: z.string().min(5),
  address: z.string().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  requiresQuote: z.boolean().default(true)
});

export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type JobIntake = z.infer<typeof JobIntakeSchema>;
