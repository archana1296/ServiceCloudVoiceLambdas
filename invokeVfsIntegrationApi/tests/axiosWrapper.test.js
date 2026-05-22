const axiosWrapper = require('../axiosWrapper');

describe('axiosWrapper', () => {
  const mockConfigData = {
    scrtEndpointBase: 'https://test-endpoint.com'
  };

  describe('getScrtEndpoint', () => {
    it('should create an axios instance with the correct base URL', () => {
      const instance = axiosWrapper.getScrtEndpoint(mockConfigData);

      expect(instance).toBeDefined();
      expect(instance.defaults.baseURL).toBe('https://test-endpoint.com');
    });

    it('should create axios instance without debug interceptors by default', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      delete process.env.LOG_LEVEL;

      const instance = axiosWrapper.getScrtEndpoint(mockConfigData);

      expect(instance).toBeDefined();
      expect(instance.interceptors.request.handlers.length).toBe(0);

      process.env.LOG_LEVEL = originalLogLevel;
    });

    it('should add interceptors when LOG_LEVEL is debug', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';

      const instance = axiosWrapper.getScrtEndpoint(mockConfigData);

      expect(instance).toBeDefined();
      expect(instance.interceptors.request.handlers.length).toBeGreaterThan(0);

      process.env.LOG_LEVEL = originalLogLevel;
    });
  });
});
