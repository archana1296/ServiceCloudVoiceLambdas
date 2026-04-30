const axios = require("axios");
const axiosRetry = require("axios-retry");
const logger = require("axios-logger");
const config = require("./config");
const secretUtils = require("./secretUtils");
const SCVLoggingUtil = require("./SCVLoggingUtil");

let scrtEndpoint = null;

async function getScrtEndpoint() {
    if (scrtEndpoint) return scrtEndpoint;
    
    const configData = await secretUtils.getSecretConfigs(config.secretName);
    scrtEndpoint = axios.create({
        baseURL: configData.scrtEndpointBase,
    });

if (config.logLevel === "debug") {
  scrtEndpoint.interceptors.request.use(
    logger.requestLogger,
    logger.errorLogger
  );
  scrtEndpoint.interceptors.response.use(
    logger.responseLogger,
    logger.errorLogger
  );
}

    // Configure retry logic with Conversation Service recommended exponential backoff
    // CS rate limit window is 30 seconds, so retry delays sum to 35s to guarantee new window
    const retryDelays = [5000, 10000, 20000];

    axiosRetry(scrtEndpoint, {
        retries: 3,
        shouldResetTimeout: true,
        retryDelay: (retryCount) => {
            return retryDelays[retryCount - 1] || retryDelays[retryDelays.length - 1];
        },
        retryCondition: (error) => {
            return error.response?.status === 429;
        },
        onRetry: (retryCount, error, requestConfig) => {
            const nextDelay = retryDelays[retryCount - 1] / 1000;
            SCVLoggingUtil.info({
                message: `Rate limited (429). Retrying in ${nextDelay}s. Retry ${retryCount}/3`,
                context: {
                    error: error.message,
                    statusCode: error.response?.status,
                    endpoint: requestConfig.url
                }
            });
        },
    });

    return scrtEndpoint;
}

module.exports = {
    getScrtEndpoint,
};
