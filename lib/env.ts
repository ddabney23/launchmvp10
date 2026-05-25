import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Cannot be empty'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Cannot be empty'),

  UPSTASH_REDIS_REST_URL: z.string().url('Must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'Cannot be empty'),

  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1, 'Cannot be empty'),
  CLOUDINARY_API_KEY: z.string().min(1, 'Cannot be empty'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'Cannot be empty'),

  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_REALTIME_SERVER_URL: z.string().url().optional(),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    result.error.issues.forEach((err) => {
      const path = err.path.map((p) => String(p)).join('.')
      console.error(`  - ${path}: ${err.message}`)
    })

    const nodeEnv = process.env['NODE_ENV'] || 'development'
    if (nodeEnv === 'production') {
      throw new Error('Environment validation failed. Check .env file.')
    }
    console.warn('⚠️  Continuing with partial environment variables in development mode')
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'] || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',
      UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'] || '',
      UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'] || '',
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'] || '',
      CLOUDINARY_API_KEY: process.env['CLOUDINARY_API_KEY'] || '',
      CLOUDINARY_API_SECRET: process.env['CLOUDINARY_API_SECRET'] || '',
      NEXT_PUBLIC_SENTRY_DSN: process.env['NEXT_PUBLIC_SENTRY_DSN'],
      SENTRY_AUTH_TOKEN: process.env['SENTRY_AUTH_TOKEN'],
      SENTRY_ORG: process.env['SENTRY_ORG'],
      SENTRY_PROJECT: process.env['SENTRY_PROJECT'],
      NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
      NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
      NEXT_PUBLIC_REALTIME_SERVER_URL: process.env['NEXT_PUBLIC_REALTIME_SERVER_URL'],
    } as z.infer<typeof envSchema>
  }

  return result.data
}

export const env = validateEnv()
export type Env = z.infer<typeof envSchema>
