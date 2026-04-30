const SCVLoggingUtil = require('../SCVLoggingUtil');

describe('SCVLoggingUtil', () => {
  let mockConsoleLog;

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  describe('info', () => {
    it('should log info message', () => {
      const logLine = {
        message: 'Test info message',
        context: { key: 'value' }
      };
      
      expect(() => SCVLoggingUtil.info(logLine)).not.toThrow();
    });

    it('should handle missing context', () => {
      const logLine = {
        message: 'Test info message'
      };
      
      expect(() => SCVLoggingUtil.info(logLine)).not.toThrow();
    });

    it('should handle missing message', () => {
      const logLine = {
        context: { key: 'value' }
      };
      
      expect(() => SCVLoggingUtil.info(logLine)).not.toThrow();
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      const logLine = {
        message: 'Test debug message',
        context: { key: 'value' }
      };
      
      expect(() => SCVLoggingUtil.debug(logLine)).not.toThrow();
    });
  });

  describe('warn', () => {
    it('should log warn message', () => {
      const logLine = {
        message: 'Test warn message',
        context: { key: 'value' }
      };
      
      expect(() => SCVLoggingUtil.warn(logLine)).not.toThrow();
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      const logLine = {
        message: 'Test error message',
        context: { key: 'value' }
      };
      
      expect(() => SCVLoggingUtil.error(logLine)).not.toThrow();
    });
  });
});
