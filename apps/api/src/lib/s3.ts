import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'

export const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? 'eu-west-2',
})

const UPLOADS_BUCKET = (process.env.S3_UPLOADS_BUCKET ?? process.env.UPLOADS_BUCKET)!
const ASSETS_BUCKET = (process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET)!

export async function getUploadPresignedUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }, // 5 minutes
  )
}

export async function getAssetSignedUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: ASSETS_BUCKET, Key: key }),
    { expiresIn: 3600 }, // 1 hour
  )
}
