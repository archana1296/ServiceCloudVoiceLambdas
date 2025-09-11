const aws = require('aws-sdk');
const SCVLoggingUtil = require('./SCVLoggingUtil');

const secretsManager = new aws.SecretsManager();

const CONFIG_KEYS = {
  CALL_CENTER_API_NAME: "CALL_CENTER_API_NAME",
  SALESFORCE_AUTH_ENDPOINT: "SALESFORCE_AUTH_ENDPOINT",
  SALESFORCE_ORG_ID: "SALESFORCE_ORG_ID",
  SALESFORCE_REST_API_ENDPOINT_BASE: "SALESFORCE_REST_API_ENDPOINT_BASE",
  SCRT_ENDPOINT_BASE: "SCRT_ENDPOINT_BASE",
  TRANSCRIBE_REGION: "TRANSCRIBE_REGION"
};

Object.freeze(CONFIG_KEYS);

/**
 * Reads a secret value from AWS Secrets Manager.
 * @param {string} secretName - The name or ARN of the secret
 * @returns {Promise<Object|null>} Hash map of secret values, or null if not found/error
 */
async function readSecret(secretName) {
  if (!secretName) {
    const errMsg = 'Secret name must be provided to readSecret';
    SCVLoggingUtil.error({
      message: errMsg,
      context: {},
    });
    throw new Error(`Failed to get secret ${secretName}: ${errMsg}`);
  }
  try {
    const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    if ('SecretString' in data) {
      try {
        // Try to parse as JSON and return the object
        const parsed = JSON.parse(data.SecretString);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        } else {
          throw new Error('SecretString is not a valid JSON object');
        }
      } catch (e) {
        throw new Error(`Failed to get secret ${secretName}: ${e.message}`);
      }
    } else if ('SecretBinary' in data) {
      // If secret is binary, throw error
      throw new Error(`Failed to get secret ${secretName}: SecretBinary is not supported`);
    }
    throw new Error(`Failed to get secret ${secretName}: Secret not found`);
  } catch (err) {
    SCVLoggingUtil.error({
      message: `Error reading secret from Secrets Manager: ${secretName}`,
      context: { error: err },
    });
    throw new Error(`Failed to get secret ${secretName}: ${err.message}`);
  }
}

/**
 * Updates a secret value in AWS Secrets Manager.
 * @param {string} secretName - The name or ARN of the secret
 * @param {Object} secretValue - The new secret value as a JSON object
 * @returns {Promise<Object>} Updated secret information
 */
async function updateSecret(secretName, secretValue) {
  if (!secretName) {
    const errMsg = 'Secret name must be provided to updateSecret';
    SCVLoggingUtil.error({
      message: errMsg,
      context: {},
    });
    throw new Error(`Failed to update secret ${secretName}: ${errMsg}`);
  }

  if (!secretValue || typeof secretValue !== 'object') {
    const errMsg = 'Secret value must be a non-null object';
    SCVLoggingUtil.error({
      message: errMsg,
      context: {},
    });
    throw new Error(`Failed to update secret ${secretName}: ${errMsg}`);
  }

  try {
    const params = {
      SecretId: secretName,
      SecretString: JSON.stringify(secretValue)
    };

    const result = await secretsManager.updateSecret(params).promise();
    SCVLoggingUtil.info({
      message: `Secret ${secretName} updated successfully`,
      context: { secretName },
    });
    return result;
  } catch (err) {
    SCVLoggingUtil.error({
      message: `Error updating secret in Secrets Manager: ${secretName}`,
      context: { error: err },
    });
    throw new Error(`Failed to update secret ${secretName}: ${err.message}`);
  }
}

async function getSecretConfigs(secretName) {
  const secretValue = await readSecret(secretName);

  const callCenterApiNameVal = secretValue[CONFIG_KEYS.CALL_CENTER_API_NAME];
  const baseURLVal = secretValue[CONFIG_KEYS.SALESFORCE_REST_API_ENDPOINT_BASE];
  const authEndpointVal = secretValue[CONFIG_KEYS.SALESFORCE_AUTH_ENDPOINT];
  const consumerKeyVal = secretValue[callCenterApiNameVal + "-salesforce-rest-api-auth-consumer-key"];
  const privateKeyVal = secretValue[callCenterApiNameVal + "-salesforce-rest-api-auth-private-key"];
  const audienceVal = secretValue[callCenterApiNameVal + "-salesforce-rest-api-audience"];
  const subjectVal = secretValue[callCenterApiNameVal + "-salesforce-rest-api-subject"];

  const configs = {
    callCenterApiName: callCenterApiNameVal,
    baseURL: baseURLVal,
    authEndpoint: authEndpointVal,
    consumerKey: consumerKeyVal,
    privateKey: privateKeyVal,
    audience: audienceVal,
    subject: subjectVal
  };

  return configs;
}

module.exports = {
  readSecret,
  getSecretConfigs,
  updateSecret
};