// Plain environment variables configuration
module.exports = {
    logLevel: process.env.LOG_LEVEL || 'info',
    secretName: process.env.SECRET_NAME,
    secretCacheS3: process.env.SECRET_CACHE_S3,
    tokenValidFor: '5m',
    audience: 'https://scrt.salesforce.com'
};