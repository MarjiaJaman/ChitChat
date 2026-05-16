const { v4: uuidv4 } = require('uuid');
const { client, BUCKET, objectUrl } = require('../config/minio');

exports.upload = async (req, res, next) => {
  try {
    const { data, name, type } = req.body;
    if (!data || !name) return res.status(400).json({ message: 'data and name are required' });

    const base64 = data.includes(',') ? data.split(',')[1] : data;
    const buffer = Buffer.from(base64, 'base64');
    const ext = name.split('.').pop().toLowerCase() || 'bin';
    const objectName = `${uuidv4()}.${ext}`;

    await client.putObject(BUCKET, objectName, buffer, buffer.length, {
      'Content-Type': type || 'application/octet-stream',
    });

    res.json({ url: objectUrl(objectName) });
  } catch (err) {
    next(err);
  }
};
