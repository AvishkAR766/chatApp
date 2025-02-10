const { v2: cloudinary } = require('cloudinary');

// Configure with separate parameters instead of URL
cloudinary.config({
    cloud_name: 'dgi6i6qpz',
    api_key: '888545921376281',
    api_secret: 'Ii606eRsEq88gyI-ifspG4JMOD0'
});

async function testConnection() {
    try {
        const result = await cloudinary.api.ping();
        console.log('Cloudinary connection successful:', result);
    } catch (error) {
        console.error('Cloudinary connection failed:', error);
    }
}

testConnection();
