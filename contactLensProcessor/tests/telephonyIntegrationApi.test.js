const api = require('../telephonyIntegrationApi');
const axios = require("axios");
const logger = require("axios-logger");

const secretUtils = require("../secretUtils");
jest.mock('../axiosWrapper');
const axiosWrapper = require('../axiosWrapper');

jest.mock('../utils');
const utils = require('../utils.js');

const secretStringJson = `{
    "CALL_CENTER_API_NAME": "multiorgscc2",
    "SALESFORCE_AUTH_ENDPOINT": "https://stmhb-ari-demo3.test2.my.pc-rnd.salesforce.com/services/oauth2/token",
    "SALESFORCE_ORG_ID": "00DZN000000CoCT",
    "SALESFORCE_REST_API_ENDPOINT_BASE": "https://stmhb-ari-demo3.test2.my.pc-rnd.salesforce.com/services/data/v54.0",
    "SCRT_ENDPOINT_BASE": "https://stmhb-ari-demo3.test2.my.pc-rnd.salesforce-scrt.com/telephony/v1",
    "TRANSCRIBE_REGION": "us-west-2",
    "multiorgscc2-salesforce-rest-api-access-token": "salesforce-rest-api-auth-access-token-key-value",
    "multiorgscc2-salesforce-rest-api-audience": "https://stmhb-ari-demo3.test2.my.pc-rnd.salesforce.com/",
    "multiorgscc2-salesforce-rest-api-auth-consumer-key": "3MVG9jO2DZUSOpAVn27areCr0lJ.8kc7KYk_82sh2ky3VofeRC775fdwAchRSp_U7TSaQQOGHgui_IETIYfJs",
    "multiorgscc2-salesforce-rest-api-auth-private-key": "test_auth_private_key",
    "multiorgscc2-salesforce-rest-api-subject": "admin@stmhb-ari-demo3.com",
    "multiorgscc2-scrt-jwt-auth-private-key": "test_private_key"
}`;
jest.mock('axios');
jest.mock('aws-sdk', () => {
    const mSecretsManager = {
        getSecretValue: jest.fn().mockReturnThis(),
        promise: jest.fn().mockResolvedValue({ SecretString: secretStringJson })
    };
    return {
        SecretsManager: jest.fn(() => mSecretsManager)
    };
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('getRateLimitedKeys', () => {
  it('returns vendorCallKeys for RESOURCE_EXHAUSTED entries', () => {
    const responseData = {
      errorResponse: {
        errorResponseEntries: [
          { vendorCallKey: 'call-1', status: 400, message: 'Error Processing Transcript with Id(s) [msg-1]. Error: io.grpc.StatusRuntimeException: RESOURCE_EXHAUSTED: Rate limit exceeded' },
          { vendorCallKey: 'call-2', status: 202, message: 'Successfully Processed Transcripts' },
          { vendorCallKey: 'call-3', status: 400, message: 'Error Processing Transcript with Id(s) [msg-3]. Error: io.grpc.StatusRuntimeException: RESOURCE_EXHAUSTED' },
        ]
      }
    };
    expect(api.getRateLimitedKeys(responseData)).toEqual(['call-1', 'call-3']);
  });

  it('returns empty array when no RESOURCE_EXHAUSTED entries', () => {
    const responseData = {
      errorResponse: {
        errorResponseEntries: [
          { vendorCallKey: 'call-1', status: 409, message: 'Transcription paused for participant' },
        ]
      }
    };
    expect(api.getRateLimitedKeys(responseData)).toEqual([]);
  });

  it('returns empty array when errorResponse is missing', () => {
    expect(api.getRateLimitedKeys({})).toEqual([]);
    expect(api.getRateLimitedKeys(null)).toEqual([]);
    expect(api.getRateLimitedKeys(undefined)).toEqual([]);
  });
});

describe('classifyBulkResponse', () => {
  it('returns success for 202 responses', () => {
    const response = { status: 202, data: { result: 'Accepted' } };
    expect(api.classifyBulkResponse(response)).toEqual({ action: 'success' });
  });

  it('returns done for 207 with no RESOURCE_EXHAUSTED entries', () => {
    const response = {
      status: 207,
      data: {
        errorResponse: {
          errorResponseEntries: [
            { vendorCallKey: 'call-1', status: 409, message: 'Transcription paused' }
          ]
        }
      }
    };
    expect(api.classifyBulkResponse(response)).toEqual({ action: 'done' });
  });

  it('returns retry with rateLimitedKeys for 207 with RESOURCE_EXHAUSTED entries', () => {
    const response = {
      status: 207,
      data: {
        errorResponse: {
          errorResponseEntries: [
            { vendorCallKey: 'call-1', status: 400, message: 'Error: RESOURCE_EXHAUSTED' },
            { vendorCallKey: 'call-2', status: 202, message: 'Success' },
          ]
        }
      }
    };
    const result = api.classifyBulkResponse(response);
    expect(result.action).toBe('retry');
    expect(result.rateLimitedKeys).toEqual(['call-1']);
  });
});

describe('SendMessagesInBulk API', () => {
  it('successfully sends bulk transcripts on 202', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    const mockPost = jest.fn(() => Promise.resolve({ status: 202, statusText: 'Accepted', data: { result: 'Accepted' } }));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    const result = await api.sendMessagesInBulk({ secretName: 'test_secret_name', entries: [{ vendorCallKey: 'call-1', messages: [] }] });
    expect(result).toEqual(expectedResponse);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('handles non-rate-limit 207 without retrying', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    const mockPost = jest.fn(() => Promise.resolve({
      status: 207,
      statusText: 'Multi-Status',
      data: {
        result: 'Multi-Status: A few messages were not processed',
        errorResponse: {
          errorResponseEntries: [
            { vendorCallKey: 'call-1', status: 409, message: 'Transcription paused for participant' }
          ]
        }
      }
    }));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    const result = await api.sendMessagesInBulk({ secretName: 'test_secret_name', entries: [{ vendorCallKey: 'call-1', messages: [] }] });
    expect(result).toEqual(expectedResponse);
    // Should not retry - only 1 call
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('retries rate-limited entries on 207 with RESOURCE_EXHAUSTED', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    // Set retry delays to 0 for fast tests
    api.RETRY_DELAYS[0] = 0;
    api.RETRY_DELAYS[1] = 0;
    api.RETRY_DELAYS[2] = 0;

    const mockPost = jest.fn()
      // First call: 207 with rate-limited entries
      .mockResolvedValueOnce({
        status: 207,
        statusText: 'Multi-Status',
        data: {
          result: 'Multi-Status: A few messages were not processed',
          errorResponse: {
            errorResponseEntries: [
              { vendorCallKey: 'call-1', status: 202, message: 'Successfully Processed Transcripts' },
              { vendorCallKey: 'call-2', status: 400, message: 'Error: io.grpc.StatusRuntimeException: RESOURCE_EXHAUSTED' },
            ]
          }
        }
      })
      // Second call (retry): 202 success
      .mockResolvedValueOnce({
        status: 202,
        statusText: 'Accepted',
        data: { result: 'Accepted' }
      });

    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    const result = await api.sendMessagesInBulk({
      secretName: 'test_secret_name',
      entries: [
        { vendorCallKey: 'call-1', messages: [{ id: 'msg-1' }] },
        { vendorCallKey: 'call-2', messages: [{ id: 'msg-2' }] },
      ]
    });

    expect(result).toEqual(expectedResponse);
    expect(mockPost).toHaveBeenCalledTimes(2);
    // Second call should only contain the rate-limited entry
    const retryPayload = mockPost.mock.calls[1][1];
    expect(retryPayload.entries).toHaveLength(1);
    expect(retryPayload.entries[0].vendorCallKey).toBe('call-2');

    // Restore original delays
    api.RETRY_DELAYS[0] = 5000;
    api.RETRY_DELAYS[1] = 10000;
    api.RETRY_DELAYS[2] = 20000;
  });

  it('stops retrying after MAX_RETRIES attempts', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    // Set retry delays to 0 for fast tests
    api.RETRY_DELAYS[0] = 0;
    api.RETRY_DELAYS[1] = 0;
    api.RETRY_DELAYS[2] = 0;

    const rateLimitResponse = {
      status: 207,
      statusText: 'Multi-Status',
      data: {
        result: 'Multi-Status: A few messages were not processed',
        errorResponse: {
          errorResponseEntries: [
            { vendorCallKey: 'call-1', status: 400, message: 'Error: io.grpc.StatusRuntimeException: RESOURCE_EXHAUSTED' },
          ]
        }
      }
    };

    // Always return rate-limited response
    const mockPost = jest.fn(() => Promise.resolve(rateLimitResponse));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    const result = await api.sendMessagesInBulk({
      secretName: 'test_secret_name',
      entries: [{ vendorCallKey: 'call-1', messages: [] }]
    });

    expect(result).toEqual(expectedResponse);
    // 1 initial + 3 retries = 4 total calls
    expect(mockPost).toHaveBeenCalledTimes(4);

    // Restore original delays
    api.RETRY_DELAYS[0] = 5000;
    api.RETRY_DELAYS[1] = 10000;
    api.RETRY_DELAYS[2] = 20000;
  });

  it('handles HTTP 429 error (Path A - handler-level rate limit)', async () => {
    const expectedResponse = { data: { result: "Success" } };
    const error = {
        response: {
            success: false,
            status: 429
        }
    };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    // axios-retry would retry 3 times before this error reaches the catch block
    const mockPost = jest.fn(() => Promise.reject(error));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));
    const result = await api.sendMessagesInBulk({ secretName: 'test_secret_name', entries: [] });
    expect(result).toEqual(expectedResponse);
  });

  it('handles non-retryable errors and still returns success', async () => {
    const expectedResponse = { data: { result: "Success" } };
    const error = {
        response: {
            success: false,
            status: 404
        }
    };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    const mockPost = jest.fn(() => Promise.reject(error));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    const result = await api.sendMessagesInBulk({ secretName: 'test_secret_name', entries: [] });
    expect(result).toEqual(expectedResponse);
  });
});

describe('SendRealtimeConversationEvents API', () => {
  it('successfully sent realtime conversation events', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    const mockPost = jest.fn(() => Promise.resolve({ data: expectedResponse }));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    await expect(await api.sendRealtimeConversationEvents('contactId', {}, 'test_secret_name')).toEqual(expectedResponse);
  });

  it('handles error when sending realtime conversation events but still sends success response', async () => {
    const expectedResponse = { data: { result: "Success" } };
    const error = {
        response: {
            success: false,
            status: 404
        }
    };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    const mockPost = jest.fn(() => Promise.reject(error));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    await expect(await api.sendRealtimeConversationEvents('contactId', {}, 'test_secret_name')).toEqual(expectedResponse);
  });
});
