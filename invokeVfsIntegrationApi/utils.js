const jwt = require("jsonwebtoken");
const uuid = require("uuid/v1");

/**
 * Generate a JWT based on the specified parameters.
 *
 * @param {object} params
 * @param {string} params.orgId - The ID of the customer's Salesforce org.
 * @param {string} params.callCenterApiName - The API name of the Salesforce CallCenter which maps to the context Amazon Connect contact center instance.
 * @param {string} params.expiresIn - Specifies when the generated JWT will expire.
 * @param {string} params.privateKey - The private key to sign the JWT.
 *
 * @return {string} - JWT token string
 */
async function generateJWT(params) {
  const { orgId, callCenterApiName, expiresIn, privateKey } = params;

  const signOptions = {
    issuer: orgId,
    subject: callCenterApiName,
    expiresIn,
    algorithm: "RS256",
    jwtid: uuid(),
  };

  return jwt.sign({}, privateKey, signOptions);
}

module.exports = {
  generateJWT,
};
