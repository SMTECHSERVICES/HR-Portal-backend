import multer from 'multer'


// Use memory storage (required on Render)
const storage = multer.memoryStorage();

// Allow all files
const upload = multer({ storage }); // no fileFilter

export default upload;