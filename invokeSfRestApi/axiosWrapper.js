const axios = require("axios");
const logger = require("axios-logger");

const apiEndpoint = axios.create({});

const authEndpoint = axios.create({});

if (process.env.LOG_LEVEL === "debug") {
  apiEndpoint.interceptors.request.use(
    logger.requestLogger,
    logger.errorLogger
  );
  apiEndpoint.interceptors.response.use(
    logger.responseLogger,
    logger.errorLogger
  );

  authEndpoint.interceptors.request.use(
    logger.requestLogger,
    logger.errorLogger
  );
  authEndpoint.interceptors.response.use(
    logger.responseLogger,
    logger.errorLogger
  );
}

module.exports = {
  apiEndpoint,
  authEndpoint,
};
