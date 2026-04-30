const axios = require('axios');
const axiosRetry = require('axios-retry');
const logger = require('axios-logger');

jest.mock('axios');
jest.mock('axios-retry');
jest.mock('axios-logger');
jest.mock('../SCVLoggingUtil');
jest.mock('../secretUtils');
const secretUtils = require('../secretUtils');

// Must re-require axiosWrapper for each test to reset the cached singleton
let getScrtEndpoint;

beforeEach(() => {
  jest.resetModules();
  jest.mock('axios');
  jest.mock('axios-retry');
  jest.mock('axios-logger');
  jest.mock('../SCVLoggingUtil');
  jest.mock('../secretUtils');

  const secretUtilsFresh = require('../secretUtils');
  secretUtilsFresh.getSecretConfigs.mockResolvedValue({
    scrtEndpointBase: 'https://example.com',
  });

  const axiosFresh = require('axios');
  axiosFresh.create = jest.fn().mockReturnValue({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  });

  getScrtEndpoint = require('../axiosWrapper').getScrtEndpoint;
});

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.LOG_LEVEL;
});

describe('getScrtEndpoint', () => {
  it('should create an axios instance with the correct baseURL', async () => {
    const axiosFresh = require('axios');
    const result = await getScrtEndpoint();

    expect(axiosFresh.create).toHaveBeenCalledWith({ baseURL: 'https://example.com' });
    expect(result).toBeDefined();
  });

  it('should not set up logger interceptors if LOG_LEVEL is not debug', async () => {
    const axiosFresh = require('axios');
    const result = await getScrtEndpoint();

    expect(result.interceptors.request.use).not.toHaveBeenCalled();
    expect(result.interceptors.response.use).not.toHaveBeenCalled();
  });

  it('should set up logger interceptors if LOG_LEVEL is debug', async () => {
    const configModule = require('../config');
    const originalLogLevel = configModule.logLevel;
    configModule.logLevel = 'debug';

    const loggerFresh = require('axios-logger');
    const result = await getScrtEndpoint();

    expect(result.interceptors.request.use).toHaveBeenCalledWith(
      loggerFresh.requestLogger,
      loggerFresh.errorLogger
    );
    expect(result.interceptors.response.use).toHaveBeenCalledWith(
      loggerFresh.responseLogger,
      loggerFresh.errorLogger
    );

    configModule.logLevel = originalLogLevel;
  });

  it('should configure axios-retry with correct settings', async () => {
    const axiosRetryFresh = require('axios-retry');
    await getScrtEndpoint();

    expect(axiosRetryFresh).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      retries: 3,
      shouldResetTimeout: true,
    }));
  });

  it('should use exponential backoff delays (5s, 10s, 20s)', async () => {
    const axiosRetryFresh = require('axios-retry');
    await getScrtEndpoint();

    const retryConfig = axiosRetryFresh.mock.calls[0][1];
    expect(retryConfig.retryDelay(1)).toBe(5000);
    expect(retryConfig.retryDelay(2)).toBe(10000);
    expect(retryConfig.retryDelay(3)).toBe(20000);
  });

  it('should retry on 429 rate limit errors', async () => {
    const axiosRetryFresh = require('axios-retry');
    await getScrtEndpoint();

    const retryConfig = axiosRetryFresh.mock.calls[0][1];
    const error429 = { response: { status: 429 } };
    expect(retryConfig.retryCondition(error429)).toBe(true);
  });

  it('should not retry on 5xx server errors', async () => {
    const axiosRetryFresh = require('axios-retry');
    await getScrtEndpoint();

    const retryConfig = axiosRetryFresh.mock.calls[0][1];
    const error500 = { response: { status: 500 } };
    const error502 = { response: { status: 502 } };
    const error503 = { response: { status: 503 } };
    expect(retryConfig.retryCondition(error500)).toBe(false);
    expect(retryConfig.retryCondition(error502)).toBe(false);
    expect(retryConfig.retryCondition(error503)).toBe(false);
  });

  it('should not retry on other 4xx client errors', async () => {
    const axiosRetryFresh = require('axios-retry');
    await getScrtEndpoint();

    const retryConfig = axiosRetryFresh.mock.calls[0][1];
    const error400 = { response: { status: 400 } };
    const error404 = { response: { status: 404 } };
    expect(retryConfig.retryCondition(error400)).toBe(false);
    expect(retryConfig.retryCondition(error404)).toBe(false);
  });
  it('should log retry info via onRetry callback', async () => {
    const axiosRetryFresh = require('axios-retry');
    const SCVLoggingUtil = require('../SCVLoggingUtil');
    await getScrtEndpoint();

    const retryConfig = axiosRetryFresh.mock.calls[0][1];
    const error = { message: 'Request failed', response: { status: 429 } };
    const requestConfig = { url: '/voiceCalls/test/postConversationEvents' };

    retryConfig.onRetry(1, error, requestConfig);

    expect(SCVLoggingUtil.info).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Retrying in 5s'),
      context: expect.objectContaining({
        statusCode: 429,
        endpoint: '/voiceCalls/test/postConversationEvents',
      }),
    }));
  });
});