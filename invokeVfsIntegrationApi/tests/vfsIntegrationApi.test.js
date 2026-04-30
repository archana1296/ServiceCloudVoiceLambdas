jest.mock('../SCVLoggingUtil');
const SCVLoggingUtil = require('../SCVLoggingUtil');

jest.mock('../axiosWrapper');
const axiosWrapper = require('../axiosWrapper');

// Mock the axiosWrapper methods
const mockGet = jest.fn();
axiosWrapper.getScrtEndpoint = jest.fn(() => ({
  get: mockGet
}));

jest.mock('../utils');
const utils = require('../utils');

jest.mock('../config', () => ({
  privateKeyParamName: 'test-private-key-param',
  orgId: 'test-org-id',
  callCenterApiName: 'test-call-center',
  tokenValidFor: '5m',
  audience: 'https://scrt.salesforce.com',
  scrtEndpointBase: 'https://test-scrt-endpoint.com'
}));

const api = require('../vfsIntegrationApi');

afterEach(() => {
  jest.clearAllMocks();
});

describe('vfsIntegrationApi', () => {

  // Mock config data that the API functions expect
  const mockConfigData = {
    orgId: 'test-org-id',
    callCenterApiName: 'test-call-center',
    tokenValidFor: '5m',
    privateKey: 'test-private-key',
    scrtEndpointBase: 'https://test-scrt-endpoint.com',
    audience: 'https://scrt.salesforce.com'
  };

  describe('getVoicemailDrop', () => {
    const contactId = 'test-contact-id';

    it('should successfully get voicemail drop', async () => {
      const expectedResponse = { 
        recordingUrl: 'https://s3.amazonaws.com/voicemail-recordings/standard-greeting.wav' 
      };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getVoicemailDrop(contactId, mockConfigData);

      verifyGenerateJWT();
      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/voicemailDrop`,
        { 
          headers: { 
            ...buildAuthHeaders(), 
            'Telephony-Provider-Name': 'amazon-connect' 
          }
        }
      );
      verifySCVLoggingUtilInfo('getVoicemailDrop');
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully retrieved voicemail drop for ${contactId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should return recordingUrl "Not found" when backend returns 404', async () => {
      const mock404Error = { response: { status: 404 } };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mock404Error);

      const result = await api.getVoicemailDrop(contactId, mockConfigData);

      expect(result).toEqual({ recordingUrl: 'Not found' });
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Voicemail drop not found for ${contactId}`,
        context: { contactId }
      });
      expect(SCVLoggingUtil.error).not.toHaveBeenCalled();
    });

    it('should handle error when getting voicemail drop', async () => {
      const mockError = new Error('API Error');      
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mockError);

      await expect(api.getVoicemailDrop(contactId, mockConfigData)).rejects.toThrow('Error getting voicemail drop');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error getting voicemail drop for ${contactId}`,
        context: { payload: mockError }
      });
    });

    it('should throw when backend returns non-404 error status', async () => {
      const mock500Error = { response: { status: 500 }, message: 'Internal Server Error' };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mock500Error);

      await expect(api.getVoicemailDrop(contactId, mockConfigData)).rejects.toThrow('Error getting voicemail drop');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error getting voicemail drop for ${contactId}`,
        context: { payload: mock500Error }
      });
    });

    it('should get voicemail drop and verify response data extraction', async () => {
      const expectedResponse = { 
        recordingUrl: 'https://s3.amazonaws.com/voicemail-recordings/standard-greeting.wav' 
      };
      const mockAxiosResponse = { data: expectedResponse, status: 200, headers: {} };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getVoicemailDrop(contactId, mockConfigData);

      expect(result).toEqual(expectedResponse);
      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('headers');
    });

    it('should get voicemail drop with different contactId format', async () => {
      const sobjectId = '00aXX000000XXXXXAAA';
      const expectedResponse = { 
        recordingUrl: 'https://s3.amazonaws.com/voicemail-recordings/greeting.wav' 
      };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getVoicemailDrop(sobjectId, mockConfigData);

      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/${sobjectId}/voicemailDrop`,
        { 
          headers: { 
            ...buildAuthHeaders(), 
            'Telephony-Provider-Name': 'amazon-connect' 
          }
        }
      );
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully retrieved voicemail drop for ${sobjectId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getDefaultOutboundPhoneNumber', () => {
    const externalRepId = 'arn:aws:connect:us-east-1:123456789012:instance/xxx/agent/yyy';

    it('should successfully get default outbound phone number with externalRepId query param', async () => {
      const expectedResponse = { phoneNumber: '+15551234567' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getDefaultOutboundPhoneNumber(externalRepId, mockConfigData);

      verifyGenerateJWT();
      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/defaultOutboundPhoneNumber?externalRepId=${encodeURIComponent(externalRepId)}`,
        {
          headers: {
            ...buildAuthHeaders(),
            'Telephony-Provider-Name': 'amazon-connect'
          }
        }
      );
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: 'Successfully retrieved default outbound phone number',
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when getting default outbound phone number', async () => {
      const mockError = new Error('API Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mockError);

      await expect(
        api.getDefaultOutboundPhoneNumber(externalRepId, mockConfigData)
      ).rejects.toThrow('Error getting default outbound phone number');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error getting default outbound phone number',
        context: { payload: mockError }
      });
    });
  });

  describe('getVoicemailGreeting', () => {
    const toPhoneNumber = '+15551234567';

    it('should successfully get voicemail greeting with query param', async () => {
      const expectedResponse = { greetingUrl: 'https://s3.example.com/greeting.wav' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getVoicemailGreeting(toPhoneNumber, mockConfigData);

      verifyGenerateJWT();
      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/voicemailGreeting?toPhoneNumber=${encodeURIComponent(toPhoneNumber)}`,
        {
          headers: {
            ...buildAuthHeaders(),
            'Telephony-Provider-Name': 'amazon-connect'
          }
        }
      );
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: 'Successfully retrieved voicemail greeting',
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should encode toPhoneNumber in query string', async () => {
      const numberWithSpecialChars = '+1 (555) 123-4567';
      const mockAxiosResponse = { data: {} };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      await api.getVoicemailGreeting(numberWithSpecialChars, mockConfigData);

      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/voicemailGreeting?toPhoneNumber=${encodeURIComponent(numberWithSpecialChars)}`,
        expect.any(Object)
      );
    });

    it('should handle error when getting voicemail greeting', async () => {
      const mockError = new Error('API Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mockError);

      await expect(
        api.getVoicemailGreeting(toPhoneNumber, mockConfigData)
      ).rejects.toThrow('Error getting voicemail greeting');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error getting voicemail greeting',
        context: { payload: mockError }
      });
    });
  });

  describe('JWT generation', () => {
    it('should generate JWT with correct parameters for getVoicemailDrop', async () => {
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue({ data: {} });

      await api.getVoicemailDrop('test-contact-id', mockConfigData);
      verifyGenerateJWT();
    });
  });
});

function verifyGenerateJWT() {
    expect(utils.generateJWT).toHaveBeenCalledWith({
        orgId: 'test-org-id',
        callCenterApiName: 'test-call-center',
        expiresIn: '5m',
        privateKey: 'test-private-key'
    });
}

function verifySCVLoggingUtilInfo(methodName) {
    expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: methodName + ' Request created',
        context: { contactId: 'test-contact-id' }
    });
}

function buildAuthHeaders() {
    return {
        Authorization: 'Bearer test-jwt-token',
        'Content-Type': 'application/json'
    };
}
