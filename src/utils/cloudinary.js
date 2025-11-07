import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRETKEY,
});

/**
 * Uploads any file (PDF or Image) to Cloudinary
 * - PDF → stored as 'raw', opens inline (no download)
 * - Image → stored as 'image'
 */
export const uploadOnCloudinary = async (fileBuffer, originalName = "file") => {
  if (!fileBuffer) throw new Error("File buffer is empty");

  const isPdf = originalName.toLowerCase().endsWith(".pdf");

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: isPdf ? "raw" : "image", // ✅ PDFs must be "raw"
        folder: "documents",
        public_id: `${originalName.split(".")[0]}_${Date.now()}`,
        access_mode: "public",
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);

        // ✅ Fix PDF URLs so they open inline instead of downloading
        const viewUrl = isPdf
          ? result.secure_url.replace(
              "/upload/",
              "/upload/fl_attachment:false/"
            )
          : result.secure_url;

        resolve({ ...result, viewUrl });
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};