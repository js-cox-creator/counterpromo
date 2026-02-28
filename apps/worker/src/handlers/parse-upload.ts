import * as XLSX from 'xlsx'
import type { ParseUploadPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { downloadFromS3 } from '../lib/s3.js'

interface ColumnMappings {
  name?: string
  price?: string
  sku?: string
  unit?: string
  category?: string
  vendor?: string
}

function findCol(row: Record<string, unknown>, patterns: string[]): string {
  const key = Object.keys(row).find(k =>
    patterns.some(p => k.toLowerCase().includes(p.toLowerCase())),
  )
  return key ? String(row[key] ?? '').trim() : ''
}

function findColByExactHeader(row: Record<string, unknown>, header: string): string {
  const key = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase())
  return key ? String(row[key] ?? '').trim() : ''
}

export async function handleParseUpload(payload: ParseUploadPayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    // Download file from S3
    const buffer = await downloadFromS3((process.env.S3_UPLOADS_BUCKET ?? process.env.UPLOADS_BUCKET)!, payload.s3Key)

    // Parse workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    // Resolve column mapping profile if mappingId is provided
    let explicitMappings: ColumnMappings | null = null
    if (payload.mappingId) {
      const mappingRecord = await prisma.importMapping.findUnique({
        where: { id: payload.mappingId },
      })
      if (mappingRecord) {
        explicitMappings = mappingRecord.mappings as ColumnMappings
      }
    }

    // Normalize rows using explicit mapping or smart detection as fallback
    const normalized = rows
      .map((row, index) => {
        let name: string
        let priceStr: string
        let sku: string
        let unit: string
        let category: string
        let vendor: string

        if (explicitMappings) {
          // Use explicit column headers from the mapping profile; fall back to smart
          // detection for any field that was not mapped.
          name = explicitMappings.name
            ? findColByExactHeader(row, explicitMappings.name) || findCol(row, ['name', 'product', 'description', 'item', 'title'])
            : findCol(row, ['name', 'product', 'description', 'item', 'title'])

          priceStr = explicitMappings.price
            ? findColByExactHeader(row, explicitMappings.price) || findCol(row, ['price', 'cost', 'amount', 'retail'])
            : findCol(row, ['price', 'cost', 'amount', 'retail'])

          sku = explicitMappings.sku
            ? findColByExactHeader(row, explicitMappings.sku) || findCol(row, ['sku', 'item_no', 'item#', 'code', 'part'])
            : findCol(row, ['sku', 'item_no', 'item#', 'code', 'part'])

          unit = explicitMappings.unit
            ? findColByExactHeader(row, explicitMappings.unit) || findCol(row, ['unit', 'uom', 'each', 'pack'])
            : findCol(row, ['unit', 'uom', 'each', 'pack'])

          category = explicitMappings.category
            ? findColByExactHeader(row, explicitMappings.category) || findCol(row, ['category', 'dept', 'department', 'type'])
            : findCol(row, ['category', 'dept', 'department', 'type'])

          vendor = explicitMappings.vendor
            ? findColByExactHeader(row, explicitMappings.vendor) || findCol(row, ['vendor', 'brand', 'supplier', 'manufacturer', 'mfr'])
            : findCol(row, ['vendor', 'brand', 'supplier', 'manufacturer', 'mfr'])
        } else {
          // Smart column detection (original behaviour)
          name = findCol(row, ['name', 'product', 'description', 'item', 'title'])
          priceStr = findCol(row, ['price', 'cost', 'amount', 'retail'])
          sku = findCol(row, ['sku', 'item_no', 'item#', 'code', 'part'])
          unit = findCol(row, ['unit', 'uom', 'each', 'pack'])
          category = findCol(row, ['category', 'dept', 'department', 'type'])
          vendor = findCol(row, ['vendor', 'brand', 'supplier', 'manufacturer', 'mfr'])
        }

        return {
          promoId: payload.promoId,
          name,
          price: parseFloat(priceStr) || 0,
          sku: sku || null,
          unit: unit || null,
          category: category || null,
          vendor: vendor || null,
          imageUrl: findCol(row, ['image', 'image_url', 'photo', 'img']) || null,
          sortOrder: index,
        }
      })
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
