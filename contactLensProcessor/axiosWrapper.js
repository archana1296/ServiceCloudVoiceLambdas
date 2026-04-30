const axios = require("axios");
const axiosRetry = require("axios-retry");
const logger = require("axios-logger");
const SCVLoggingUtil = require("./SCVLoggingUtil");

/**
 * Create axios instance with dynamic endpoint configuration
 * @param {object} configData - Configuration containing scrtEndpointBase
 * @returns {object} Configured axios instance
 */
function getScrtEndpoint(configData) {
  const instance = axios.create({
    baseURL: configData.scrtEndpointBase,
  });

  if (process.env.LOG_LEVEL === "debug") {
    instance.interceptors.request.use(
        logger.requestLogger,
        logger.errorLogger
    );
    instance.interceptors.response.use(
        logger.responseLogger,
        logger.errorLogger
    );
  }

  // Configure retry logic with Conversation Service recommended exponential backoff
  // CS rate limit window is 30 seconds, so retry delays sum to 35s to guarantee new window
  // CS recommendation: 5s, 10s, 20s (totaling 35s to guarantee new rate limit window)
  const retryDelays = [5000, 10000, 20000];

  axiosRetry(instance, {
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

  return instance;
}

module.exports = {
  getScrtEndpoint,
};
