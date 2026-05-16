const router = require('express').Router();
const { client, BUCKET } = require('../config/minio');

const MIME = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
};

router.get('/', async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).end();

    const decoded = decodeURIComponent(url);
    const objectName = decoded.split(`/${BUCKET}/`)[1];
    if (!objectName) return res.status(400).end();

    const ext = objectName.split('.').pop().toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const stream = await client.getObject(BUCKET, objectName);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
