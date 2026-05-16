const Minio = require('minio');

const client = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const BUCKET = process.env.MINIO_BUCKET || 'chitchat';
const PUBLIC_URL = (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '');

async function initMinio() {
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET);
  }
  // Allow public read on all objects
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${BUCKET}/*`],
    }],
  });
  await client.setBucketPolicy(BUCKET, policy);
  console.log(`MinIO bucket "${BUCKET}" ready`);
}

function objectUrl(objectName) {
  return `${PUBLIC_URL}/${BUCKET}/${objectName}`;
}

module.exports = { client, BUCKET, PUBLIC_URL, initMinio, objectUrl };
