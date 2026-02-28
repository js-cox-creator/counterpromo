import { Writable } from 'stream'
import type { ExportZipPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { downloadFromS3, uploadToS3 } from '../lib/s3.js'
import { createRequire } from 'module'

// archiver is a CommonJS package — use createRequire for ESM compatibility
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver') as (format: string, options?: object) => import('archiver').Archiver

function buildZipBuffer(files: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    const output = new Writable({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
        cb()
      },
    })

    output.on('finish', () => resolve(Buffer.concat(chunks)))

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', reject)
    archive.pipe(output)

    for (const file of files) {
      archive.append(file.data, { name: file.name })
    }

    void archive.finalize()
  })
}

function deriveFilename(s3Key: string): string {
  return s3Key.split('/').pop() ?? s3Key.replace(/\//g, '_')
}

export async function handleExportZip(payload: ExportZipPayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    const assets = await prisma.asset.findMany({
      where: {
        promoId: payload.promoId,
        accountId: payload.accountId,
        type: { not: 'zip' }, // exclude previously generated ZIPs
      },
      orderBy: { createdAt: 'asc' },
    })

    const bucket = (process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET)!

    const fileEntries = await Promise.all(
      assets.map(async (asset) => {
        const data = await downloadFromS3(bucket, asset.s3Key)
        return { name: `${asset.type}/${deriveFilename(asset.s3Key)}`, data }
      }),
    )

    const zipBuffer = await buildZipBuffer(fileEntries)

    const s3Key = `assets/${payload.accountId}/${payload.promoId}/zip/${Date.now()}.zip`

    await uploadToS3(bucket, s3Key, zipBuffer, 'application/zip')

    await prisma.asset.create({
      data: {
        accountId: payload.accountId,
        promoId: payload.promoId,
        type: 'zip',
        s3Key,
        sizeBytes: zipBuffer.length,
      },
    })

    await completeJob(payload.jobId, { s3Key, sizeBytes: zipBuffer.length })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
