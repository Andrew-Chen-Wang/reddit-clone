import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getS3BucketName, s3Client } from "./client"

const DOWNLOAD_EXPIRY_SECONDS = 24 * 60 * 60

// Presigns a time-limited GET for a private object key. Adapted from BestFit to take a
// bare object key rather than a full URL, since Garage serves path-style URLs where the
// bucket is part of the path.
export async function getPresignedUrl(key: string, fileName?: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getS3BucketName(),
    Key: key,
    ResponseContentDisposition: fileName ? `attachment; filename="${fileName}"` : undefined,
  })
  return getSignedUrl(s3Client, command, { expiresIn: DOWNLOAD_EXPIRY_SECONDS })
}
