import { Router } from "express";
import crypto from "crypto";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../lib/prisma";
import { s3 } from "../lib/s3";
import { requireAuth } from "../middleware/auth";
import { queue } from "../queue/queue";

export const mediaRouter = Router();

mediaRouter.post("/presign", requireAuth, async (req) => {
  const { fileName, mime, size } = req.body;
  const ext = fileName.split(".").pop();
  const key = `uploads/${req.user.id}/${crypto.randomUUID()}.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key,
    ContentType,
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  const fileUrl = `${process.env.AWS_S3_PUBLIC_BASE_URL}/${key}`;

  const media = await prisma.media.create({
    data{
      userId: req.user.id,
      type: mime.startsWith("video") ? "VIDEO" : "IMAGE",
      mime,
      size,
      key,
      originalUrl,
    },
  });

  res.json({ mediaId: media.id, uploadUrl, fileUrl });
});

mediaRouter.post("/confirm", requireAuth, async (req) => {
  const { mediaId } = req.body;
  const media = await prisma.media.findUnique({ where{ id: mediaId } });

  await s3.send(new HeadObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: media!.key,
  }));

  if (media?.type === "IMAGE") {
    await queue.add("generate_thumbnails", { mediaId });
  }

  res.json({ ok: true });
});
