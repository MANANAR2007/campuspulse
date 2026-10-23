import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';

const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = config;

/**
 * Check whether Cloudinary credentials are fully configured on the server
 */
export const isCloudinaryConfigured = () => {
  return Boolean(
    cloudinaryCloudName &&
      cloudinaryApiKey &&
      cloudinaryApiSecret &&
      cloudinaryCloudName.trim() !== '' &&
      cloudinaryApiKey.trim() !== '' &&
      cloudinaryApiSecret.trim() !== ''
  );
};

// Initialize Cloudinary instance if credentials are present
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: cloudinaryCloudName,
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret,
    secure: true,
  });
}

/**
 * Upload a memory buffer to Cloudinary using upload_stream
 * @param {Buffer} buffer - File buffer from Multer memoryStorage
 * @param {Object} options - Upload options (folder, etc.)
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(
        new Error(
          'Image upload is currently unavailable due to missing Cloudinary configuration on the server.'
        )
      );
    }

    const uploadOptions = {
      folder: 'campuspulse/issues',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve({
        secure_url: result.secure_url,
        public_id: result.public_id,
      });
    });

    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary by its public ID
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<any>}
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) {
    return null;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('⚠️  Failed to delete Cloudinary asset:', publicId, error.message);
    return null;
  }
};
