import multer from 'multer';

// Allowed raster image mime types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Multer memory storage configuration (keeps file in buffer for Cloudinary stream)
const storage = multer.memoryStorage();

// File filter checking declared MIME type
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Unsupported file format. Please upload a valid JPEG, PNG, or WebP image.'
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB strict limit
    files: 1, // Only 1 image per issue
  },
  fileFilter,
});

/**
 * Validate buffer magic bytes to ensure file is genuinely a raster image
 * @param {Buffer} buffer 
 * @returns {boolean}
 */
export const validateImageMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 4) return false;

  // JPEG: Starts with FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: Starts with 89 50 4E 47 (.PNG)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  // WEBP: Starts with RIFF and has WEBP at offset 8
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return true;
  }

  return false;
};

/**
 * Middleware handling single 'image' field upload with clean error surfacing
 */
export const uploadSingleImage = (req, res, next) => {
  const uploadHandler = upload.single('image');

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'fail',
            message: 'Image file size exceeds the 5 MB limit. Please select a smaller file.',
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            status: 'fail',
            message: 'Unexpected file upload field. The photo must be uploaded under the field name "image".',
          });
        }
        return res.status(400).json({
          status: 'fail',
          message: `Upload error: ${err.message}`,
        });
      }

      // Custom fileFilter error
      return res.status(400).json({
        status: 'fail',
        message: err.message,
      });
    }

    // Secondary verification: Verify buffer magic bytes if a file was provided
    if (req.file && req.file.buffer) {
      const isValid = validateImageMagicBytes(req.file.buffer);
      if (!isValid) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid image data. File contents do not match genuine JPEG, PNG, or WebP raster formats.',
        });
      }
    }

    next();
  });
};
