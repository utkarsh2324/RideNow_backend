import express from "express";
import { upload } from "../middlewares/multer.middlewares.js";

// FIX: Corrected the filename to match 'hostauth.middleware.js'
import { verifyHostJWT } from "../middlewares/hostauth.middleware.js";

// Changed to import from a new hostprofile.controllers.js
import { 
    uploadHostProfilePhoto, 
    updateHostBasicInfo, 
    updateHostMobileNumber 
} from "../controllers/hostprofile.controllers.js";

const router = express.Router();

// All routes are now protected by verifyHostJWT and use host-specific controllers
router.post("/upload-photo", verifyHostJWT, upload.single("photo"), uploadHostProfilePhoto);

router.patch("/update-basic", verifyHostJWT, updateHostBasicInfo);

router.patch("/update-mobile", verifyHostJWT, updateHostMobileNumber);

export default router;
