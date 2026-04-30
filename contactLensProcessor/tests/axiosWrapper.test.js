const axios = require('axios');
const axiosRetry = require('axios-retry');
const logger = require('axios-logger');

// Mock axios, axios-retry and logger
jest.mock('axios');
jest.mock('axios-retry');
jest.mock('axios-logger');
jest.mock('../SCVLoggingUtil');

const { getScrtEndpoint } = require('../axiosWrapper');

describe('getScrtEndpoint', () => {
  let createMock;
  let instanceMock;

  beforeEach(() => {
    instanceMock = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    createMock = jest.fn().mockReturnValue(instanceMock);
    axios.create = createMock;
    process.env.LOG_LEVEL = ''; // default
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it('should create an axios instance with the correct baseURL', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    const result = getScrtEndpoint(configData);

    expect(axios.create).toHaveBeenCalledWith({ baseURL: 'https://example.com' });
    expect(result).toBe(instanceMock);
  });

  it('should not set up logger interceptors if LOG_LEVEL is not debug', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    expect(instanceMock.interceptors.request.use).not.toHaveBeenCalled();
    expect(instanceMock.interceptors.response.use).not.toHaveBeenCalled();
  });

  it('should set up logger interceptors if LOG_LEVEL is debug', () => {
    process.env.LOG_LEVEL = 'debug';
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    expect(instanceMock.interceptors.request.use).toHaveBeenCalledWith(
      logger.requestLogger,
      logger.errorLogger
    );
    expect(instanceMock.interceptors.response.use).toHaveBeenCalledWith(
      logger.responseLogger,
      logger.errorLogger
    );
  });

  it('should configure axios-retry with correct settings', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    expect(axiosRetry).toHaveBeenCalledWith(instanceMock, expect.objectContaining({
      retries: 3,
      shouldResetTimeout: true,
    }));
  });

  it('should use exponential backoff delays (5s, 10s, 20s)', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    const retryConfig = axiosRetry.mock.calls[0][1];
    expect(retryConfig.retryDelay(1)).toBe(5000);
    expect(retryConfig.retryDelay(2)).toBe(10000);
    expect(retryConfig.retryDelay(3)).toBe(20000);
  });

  it('should retry on 429 rate limit errors', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    const retryConfig = axiosRetry.mock.calls[0][1];
    const error429 = { response: { status: 429 } };
    expect(retryConfig.retryCondition(error429)).toBe(true);
  });

  it('should not retry on 5xx server errors', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    const retryConfig = axiosRetry.mock.calls[0][1];
    const error500 = { response: { status: 500 } };
    const error502 = { response: { status: 502 } };
    const error503 = { response: { status: 503 } };
    expect(retryConfig.retryCondition(error500)).toBe(false);
    expect(retryConfig.retryCondition(error502)).toBe(false);
    expect(retryConfig.retryCondition(error503)).toBe(false);
  });

  it('should not retry on other 4xx client errors', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    const retryConfig = axiosRetry.mock.calls[0][1];
    const error400 = { response: { status: 400 } };
    const error404 = { response: { status: 404 } };
    expect(retryConfig.retryCondition(error400)).toBe(false);
    expect(retryConfig.retryCondition(error404)).toBe(false);
  });
});