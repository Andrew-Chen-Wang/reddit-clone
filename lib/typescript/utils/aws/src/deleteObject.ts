import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getS3BucketName, s3Client } from "./client"

export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: getS3BucketName(), Key: key }))
}
