// Wiring example (copy into your ads routes/controller):
//
// import { moderationGuard } from "../moderation/guard";
// import { upsertModerationCase } from "../moderation/caseService";
//
// app.post("/ads", requireAuth, moderationGuard(), async (req) => {
//   const ad = await prisma.ad.create({ data{ ...req.body, userId: req.user.id, status: req.forceAdStatus ?? "PENDING_REVIEW" } });
//   await upsertModerationCase({
//     adId: ad.id,
//     userId: req.user.id,
//     country: req.body.country,
//     categorySlug: req.body.categorySlug,
//     score: req.moderationScore ?? 0,
//     reasons: req.moderationReasons ?? {},
//   });
//   res.json({ ad });
// });
//
// app.use("/admin/moderation", adminModerationRouter);
