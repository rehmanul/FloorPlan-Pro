require('dotenv').config();
const axios = require('axios');

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

async function testTranslation() {
    try {
        // Get token
        const authResponse = await axios.post('https://developer.api.autodesk.com/authentication/v2/token', 
            `client_id=${APS_CLIENT_ID}&client_secret=${APS_CLIENT_SECRET}&grant_type=client_credentials&scope=viewables:read`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const token = authResponse.data.access_token;
        console.log('✅ Token obtained');

        // Test with your URN
        const urn = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ynpja29meW52ZTJ3NHJwem55bW9vYnlhZ3VxeGt3ZWwvMTc1NjU2NDk1NjkxMC1vdm9ET1NTSUVSJTIwQ09TVE8lMjAtJTIwcGxhbiUyMGVudHJlc29sLSUyMHByb2pldC0uZHhm';
        
        const manifestResponse = await axios.get(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('📋 Manifest Response:');
        console.log(JSON.stringify(manifestResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testTranslation();