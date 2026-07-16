import { HeadObjectCommand } from "@aws-sdk/client-s3"
import { getS3BucketName, s3Client } from "./client"

export async function existsOnS3(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: getS3BucketName(), Key: key }))
    return true
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status === 404 || status === 403) return false
    throw err
  }
}
