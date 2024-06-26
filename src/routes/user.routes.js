import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  userController.registerUser
);
router.route("/login").post(userController.loginUser);
router.get("/check-username-unique", userController.checkUserNameIsUnique);
router.get("/get", userController.get);
router.route("/:username/channel-profile").get(userController.getUserChannelProfile);

// Protect all routes after this middleware
router.route("/profile").get(verifyJWT, userController.getCurrentUserProfile);
router.route("/user").get(verifyJWT, userController.getCurrentUser);
router.route("/watch-history").get(verifyJWT, userController.getUserWatchHistory);
router.route("/like-videos").get(verifyJWT, userController.getUserLikeVideos);
router.route("/logout").post(verifyJWT, userController.logoutUser);
router.route("/refresh-token").post(userController.refreshAccessToken);
router.route("/reset-password").post(verifyJWT, userController.changeCurrentPassword);
router.route("/user-account").patch(verifyJWT, userController.updateUserAccountDetails);
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), userController.updateUserAvatar);
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), userController.updateUserCoverImage);
export default router;
