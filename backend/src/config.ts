import path from 'node:path'

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-this-secret',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  storageDir: path.resolve(process.cwd(), process.env.STORAGE_DIR ?? './storage/private'),
  kernelSourceDir: path.resolve(process.cwd(), process.env.KERNEL_SOURCE_DIR ?? './storage/kernel/linux-6.8'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 1024 * 1024 * 1024),
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'change-me-now',
}

if (config.jwtSecret === 'dev-only-change-this-secret') {
  console.warn('[security] JWT_SECRET is using the development fallback. Set it before deployment.')
}
