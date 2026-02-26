import * as XLSX from 'xlsx'
import type { ParseUploadPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { downloadFromS3 } from '../lib/s3.js'

function findCol(row: Record<string, unknown>, patterns: string[]): string {
  const key = Object.keys(row).find(k =>
    patterns.some(p => k.toLowerCase().includes(p.toLowerCase())),
  )
  return key ? String(row[key] ?? '').trim() : ''
}

export async function handleParseUpload(payload: ParseUploadPayload): Promise<void> {
  await startJob(payload.jobId)

  try {
    // Download file from S3
    const buffer = await downloadFromS3((process.env.S3_UPLOADS_BUCKET ?? process.env.UPLOADS_BUCKET)!, payload.s3Key)

    // Parse workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    // Normalize rows
    const normalized = rows
      .map((row, index) => ({
        promoId: payload.promoId,
        name: findCol(row, ['name', 'product', 'description', 'item', 'title']),
        price: parseFloat(findCol(row, ['price', 'cost', 'amount', 'retail'])) || 0,
        sku: findCol(row, ['sku', 'item_no', 'item#', 'code', 'part']) || null,
        unit: findCol(row, ['unit', 'uom', 'each', 'pack']) || null,
        category: findCol(row, ['category', 'dept', 'department', 'type']) || null,
        vendor: findCol(row, ['vendor', 'brand', 'supplier', 'manufacturer', 'mfr']) || null,
        imageUrl: findCol(row, ['image', 'image_url', 'photo', 'img']) || null,
        sortOrder: index,
      }))
      .filter(item => item.name !== '')

    // Transaction: delete existing items and create new ones
    await prisma.$transaction([
      prisma.promoItem.deleteMany({ where: { promoId: payload.promoId } }),
      prisma.promoItem.createMany({ data: normalized }),
    ])

    // Update upload record
    await prisma.upload.update({
      where: { id: payload.uploadId },
      data: { parsedAt: new Date() },
    })

    await completeJob(payload.jobId, { itemsCreated: normalized.length })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
