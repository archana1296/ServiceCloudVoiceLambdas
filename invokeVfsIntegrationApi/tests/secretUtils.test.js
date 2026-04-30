jest.mock('../SCVLoggingUtil');
const SCVLoggingUtil = require('../SCVLoggingUtil');

jest.mock('aws-sdk', () => {
  const mockGetSecretValue = jest.fn();
  return {
    SecretsManager: jest.fn(() => ({
      getSecretValue: mockGetSecretValue
    })),
    mockGetSecretValue
  };
});

const AWS = require('aws-sdk');
const secretUtils = require('../secretUtils');

describe('secretUtils', () => {
  let mockSecretsManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSecretsManager = new AWS.SecretsManager();
  });

  describe('getSecretConfigs', () => {
    const mockSecretData = {
      SALESFORCE_ORG_ID: 'test-org-id',
      SCRT_ENDPOINT_BASE: 'https://test-endpoint.com',
      CALL_CENTER_API_NAME: 'test-call-center',
      'test-call-center-scrt-jwt-auth-private-key': 'test-private-key'
    };

    it('should successfully get secret configs', async () => {
      AWS.mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(mockSecretData)
        })
      });

      const result = await secretUtils.getSecretConfigs('test-secret');

      expect(result).toEqual({
        audience: 'https://scrt.salesforce.com',
        orgId: 'test-org-id',
        scrtEndpointBase: 'https://test-endpoint.com',
        callCenterApiName: 'test-call-center',
        privateKey: 'test-private-key',
        tokenValidFor: '5m'
      });
    });

    it('should throw error when secret name is not provided', async () => {
      await expect(secretUtils.getSecretConfigs(null)).rejects.toThrow('Secret name is required');
    });

    it('should throw error when secret retrieval fails', async () => {
      const mockError = new Error('Secret not found');
      AWS.mockGetSecretValue.mockReturnValue({
        promise: jest.fn().mockRejectedValue(mockError)
      });

      await expect(secretUtils.getSecretConfigs('test-secret')).rejects.toThrow('Secret not found');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error reading secret from AWS Secrets Manager',
        context: { secretName: 'test-secret', error: 'Secret not found' }
      });
    });
  });
});
