// Example wiring (copy into your server/app file)
//
// import { linkUserDevice } from "./security/deviceLink";
// import { enforceDuplicatePolicy } from "./security/duplicateEnforce";
// import { publicShadowbanFilter } from "./security/shadowban";
// import { adminAdvancedSecurityRouter } from "./routes/adminAdvancedSecurity";
//
// // 1) Track devices on authenticated requests (e.g. global middleware after auth)
// app.use(async (req) => {
//   try {
//     if (req.user?.id) await linkUserDevice(req);
//   } catch {}
//   next();
// });
//
// // 2) On ad create/update (before writing), enforce duplicates
// // const dupe = await enforceDuplicatePolicy({ userId:req.user.id, title, description });
// // if (dupe.forceStatus) req.forceAdStatus = dupe.forceStatus;
//
// // 3) On public listings queries, add filter:
// // where{ status:"PUBLISHED", ...publicShadowbanFilter() }
//
// // 4) Mount admin routes
// app.use("/admin/security-advanced", adminAdvancedSecurityRouter);
