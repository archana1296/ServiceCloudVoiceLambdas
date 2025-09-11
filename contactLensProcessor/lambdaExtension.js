const axios = require("axios");

const aws_session_token = process.env.AWS_SESSION_TOKEN;

// AWS Lambda Extension Ports
const ports = {
  SSM_LAMBDA_EXTENSION_PORT: 2773,
};

async function executeExtension(url, port, requestParams) {
  const awsLambdaExtensionClient = axios.create({
    baseURL: `http://localhost:${port}`,
    timeout: 5000,
    headers: {
      "x-aws-parameters-secrets-token": aws_session_token,
      "X-Aws-Parameters-Secrets-Extension-TTL": "300",
    },
  });
  const lambdaExtensionResponse = await awsLambdaExtensionClient.get(url, {
    params: requestParams,
  });
  return lambdaExtensionResponse;
}

/**
 * Reads a value from AWS Secrets Manager via Lambda Extension HTTP endpoint
 * @param {string} secretName - The name of the secret to retrieve
 * @returns {Promise<Object>} The secret value (entire object)
 */
async function readSecretOverExtension(secretName) {
  if (!secretName) {
    throw new Error('Secret name is required');
  }
  const port = ports.SSM_LAMBDA_EXTENSION_PORT;
  const url = `/secretsmanager/get`;
  const requestParams = { secretId: secretName };
  const response = await executeExtension(url, port, requestParams);
  const secretObj = JSON.parse(response.data.SecretString);
  return secretObj;
}

module.exports = {
  readSecretOverExtension,
};
