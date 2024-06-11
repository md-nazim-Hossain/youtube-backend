import { Router } from "express";
import { videoController } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();
router.route("/get-all-videos").get(videoController.getAllVideos);
router.route("/get-video/:id").get(videoController.getVideoById);
// Protect all routes after this middleware
router.route("/upload-video").post(
  verifyJWT,
  upload.fields([
    {
      name: "videoFiles",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  videoController.uploadVideo
);
router.route("/delete-video/:id").delete(verifyJWT, videoController.deleteVideo);

export default router;