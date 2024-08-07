import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { playlistController } from "../controllers/playlist.controller.js";

const router = Router();

router.route("/get-all-playlist-by-user-id/:id").get(playlistController.getAllPlaylistByUserId);
// Protect all routes after this middleware
router.route("/get-all-playlists").get(verifyJWT, playlistController.getAllPlaylists);
router.route("/playlist/:id").get(verifyJWT, playlistController.getPlayListById);
router.route("/create-playlist").post(verifyJWT, playlistController.createPlaylist);
router.route("/update-playlist/:id").put(verifyJWT, playlistController.updatePlaylist);
router.route("/delete-playlist/:id").delete(verifyJWT, playlistController.deletePlaylist);

export default router;
