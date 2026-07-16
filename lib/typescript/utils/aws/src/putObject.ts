import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getS3BucketName, s3Client } from "./client"

export async function putObjectToS3(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: getS3BucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}
