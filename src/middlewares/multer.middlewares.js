import multer from "multer";

// Use memory storage so file stays in RAM
const storage = multer.memoryStorage();

export const upload = multer({ storage });