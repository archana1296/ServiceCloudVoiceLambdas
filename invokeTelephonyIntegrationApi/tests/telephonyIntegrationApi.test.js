jest.mock('../SCVLoggingUtil');
const SCVLoggingUtil = require('../SCVLoggingUtil');

jest.mock('../axiosWrapper');
const axiosWrapper = require('../axiosWrapper');

// Mock the axiosWrapper methods
const mockPost = jest.fn();
const mockPatch = jest.fn();
axiosWrapper.getScrtEndpoint = jest.fn(() => ({
  post: mockPost,
  patch: mockPatch
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

const api = require('../telephonyIntegrationApi');

afterEach(() => {
  jest.clearAllMocks();
});

describe('telephonyIntegrationApi', () => {

  // Mock config data that the API functions expect
  const mockConfigData = {
    orgId: 'test-org-id',
    callCenterApiName: 'test-call-center',
    tokenValidFor: '5m',
    privateKey: 'test-private-key',
    scrtEndpointBase: 'https://test-scrt-endpoint.com',
    audience: 'https://scrt.salesforce.com'
  };

  describe('createVoiceCall', () => {
    const mockFieldValues = {
      callCenterApiName: 'test-call-center',
      vendorCallKey: 'test-contact-id',
      to: '+1234567890',
      from: '+0987654321',
      initiationMethod: 'Inbound',
      startTime: '2023-01-01T00:00:00.000Z',
      callSubtype: 'PSTN',
      callAttributes: '{}',
      participants: [
        {
          participantKey: '+0987654321',
          type: 'END_USER'
        }
      ]
    };

    it('should successfully create voice call', async () => {
      const expectedResponse = { voiceCallRecordId: 'voice-call-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.createVoiceCall(mockFieldValues, mockConfigData);

      verifyGenerateJWT();
      expect(mockPost).toHaveBeenCalledWith(
        '/voiceCalls',
        {
          ...mockFieldValues,
          callCenterApiName: 'test-call-center'
        },
        {
          headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' }
        }
      );
      verifySCVLoggingUtilInfo('CreateVoiceCall');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when creating voice call', async () => {
      const mockError = new Error('API Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockRejectedValue(mockError);

      await expect(api.createVoiceCall(mockFieldValues, mockConfigData)).rejects.toThrow('Error creating VoiceCall record');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error creating VoiceCall record',
        context: { payload: mockError }
      });
    });
  });

  describe('updateVoiceCall', () => {
    const contactId = 'test-contact-id';
    const fieldValues = {
      status: 'completed',
      endTime: '2023-01-01T01:00:00.000Z'
    };

    it('should successfully update voice call', async () => {
      const expectedResponse = { success: true };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.updateVoiceCall(contactId, fieldValues, mockConfigData);

      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}`,
        fieldValues,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      verifySCVLoggingUtilInfo('updateVoiceCall');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when updating voice call', async () => {
      const mockError = new Error('Update Error');

      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.updateVoiceCall(contactId, fieldValues, mockConfigData)).rejects.toThrow('Error updating VoiceCall record.');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error updating VoiceCall record',
        context: { payload: mockError }
      });
    });
  });

  describe('executeOmniFlow', () => {
    const contactId = 'test-contact-id';
    const payload = {
      flowDevName: 'TestFlow',
      fallbackQueue: 'TestQueue',
      dialedNumber: '+1234567890',
      flowInputParameters: { param1: 'value1' }
    };

    it('should successfully execute omni flow', async () => {
      const expectedResponse = { flowExecutionId: 'flow-exec-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.executeOmniFlow(contactId, payload, mockConfigData);

      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/omniFlow`,
        payload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      verifySCVLoggingUtilInfo('executeOmniFlow');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when executing omni flow', async () => {
      const mockError = new Error('Flow Error');

      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.executeOmniFlow(contactId, payload, mockConfigData)).rejects.toThrow('Error executing Omni Flow');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error executing Omni Flow with ${contactId}`,
        context: { payload: mockError }
      });
    });
  });

  describe('sendMessage', () => {
    const contactId = 'test-contact-id';
    const payload = {
      message: 'Test message',
      callCenterApiName: 'test-call-center'
    };

    it('should successfully send message', async () => {
      const expectedResponse = { messageId: 'msg-id' };
      const mockAxiosResponse = { data: expectedResponse };

      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.sendMessage(contactId, payload, mockConfigData);

      verifyGenerateJWT();
      expect(mockPost).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/messages`,
        payload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      verifySCVLoggingUtilInfo('sendMessage');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when sending message and return error result', async () => {
      const mockError = new Error('Send Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockRejectedValue(mockError);

      const result = await api.sendMessage(contactId, payload, mockConfigData);

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error sending transcript with ${contactId}`,
        context: { payload: mockError }
      });
      expect(result).toEqual({ result: 'Error' });
    });
  });

  describe('cancelOmniFlowExecution', () => {
    const contactId = 'test-contact-id';

    it('should successfully cancel omni flow execution', async () => {
      const expectedResponse = { success: true };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.cancelOmniFlowExecution(contactId, mockConfigData);

      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/clearRouting`,
        null,
        { headers: buildAuthHeaders() }
      );
      verifySCVLoggingUtilInfo('cancelOmniFlowExecution');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when cancelling omni flow execution', async () => {
      const mockError = new Error('Cancel Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.cancelOmniFlowExecution(contactId, mockConfigData)).rejects.toThrow('Error cancelling OmniFlowExecution');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error cancelling OmniFlowExecution with ${contactId}`,
        context: { payload: mockError }
      });
    });
  });

  describe('rerouteFlowExecution', () => {
    const contactId = 'test-contact-id';

    it('should successfully reroute flow execution', async () => {
      const expectedResponse = { success: true };
      const mockAxiosResponse = { data: expectedResponse };

      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.rerouteFlowExecution(contactId, mockConfigData);

      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/reroute`,
        null,
        { headers: buildAuthHeaders() }
      );
      verifySCVLoggingUtilInfo('rerouteFlowExecution');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when rerouting flow execution', async () => {
      const mockError = new Error('Reroute Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.rerouteFlowExecution(contactId, mockConfigData)).rejects.toThrow('Error in Reroute Flow Execution');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error in Reroute Flow Execution with ${contactId}`,
        context: { payload: mockError }
      });
    });
  });

  describe('callbackExecution', () => {
    const contactId = 'test-contact-id';
    const payload = {
      callbackNumber: '+1234567890'
    };

    it('should successfully execute callback', async () => {
      const expectedResponse = { callbackId: 'callback-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.callbackExecution(contactId, payload, mockConfigData);

      verifyGenerateJWT();
      expect(mockPost).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/requestCallback`,
        payload,
        { headers: buildAuthHeaders() }
      );
      verifySCVLoggingUtilInfo('Callback');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when executing callback', async () => {
      const mockError = new Error('Callback Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockRejectedValue(mockError);

      await expect(api.callbackExecution(contactId, payload, mockConfigData)).rejects.toThrow('Error in Callback Execution');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error in Callback request execution with ${contactId}`,
        context: { payload: mockError }
      });
    });
  });

  describe('JWT generation', () => {
    it('should generate JWT with correct parameters for all API calls', async () => {
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue({ data: {} });

      await api.createVoiceCall({
        callCenterApiName: 'test-call-center',
        vendorCallKey: 'test-contact-id'
      }, mockConfigData);
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