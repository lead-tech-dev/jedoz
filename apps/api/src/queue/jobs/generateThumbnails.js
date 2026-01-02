import sharp from "sharp";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../../lib/prisma";
import { s3 } from "../../lib/s3";

export async function generateThumbnailsJob(mediaId) {
  const media = await prisma.media.findUnique({ where{ id: mediaId } });
  if (!media) return;

  const obj = await s3.send(new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: media.key,
  }));

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks= [];
    obj.Body?.on("data", (c) => chunks.push(c));
    obj.Body?.on("end", () => resolve(Buffer.concat(chunks)));
    obj.Body?.on("error", reject);
  });

  const thumb = await sharp(buffer).resize({ width: 400 }).webp().toBuffer();
  const thumbKey = media.key.replace("uploads/", "thumbs/").replace(/\..+$/, ".webp");

  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key,
    Body,
    ContentType: "image/webp",
  }));

  await prisma.media.update({
    where{ id: media.id },
    data{
      thumbUrl: `${process.env.AWS_S3_PUBLIC_BASE_URL}/${thumbKey}`,
      status: "PROCESSED",
    },
  });
}
