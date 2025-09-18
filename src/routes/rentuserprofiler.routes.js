import express from "express";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { uploadProfilePhoto } from "../controllers/rentuserprofile.controllers.js";
import { updateBasicInfo,updateMobileNumber } from "../controllers/rentuserprofile.controllers.js";

const router = express.Router();


router.post("/upload-photo", verifyJWT, upload.single("photo"), uploadProfilePhoto);
router.patch("/update-basic", verifyJWT, updateBasicInfo);
router.patch("/update-mobile", verifyJWT, updateMobileNumber);

export default router;