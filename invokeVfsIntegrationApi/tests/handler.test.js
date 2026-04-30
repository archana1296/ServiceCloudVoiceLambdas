const handler = require("../handler");

jest.mock("../SCVLoggingUtil");
const SCVLoggingUtil = require("../SCVLoggingUtil");

jest.mock("../vfsIntegrationApi");
const api = require("../vfsIntegrationApi");

jest.mock("../secretUtils");
const secretUtils = require("../secretUtils");

jest.mock("../config");
const config = require("../config");

config.secretName = "test-secret";

// Mock default secret configuration
const mockSecretConfig = {
  callCenterApiName: "test-call-center",
  orgId: "test-org-id",
  scrtEndpointBase: "https://test-endpoint.com",
  privateKey: "test-private-key",
  audience: "test-audience",
  tokenValidFor: "10m"
};

// Set up default mocks
beforeEach(() => {
  secretUtils.getSecretConfigs.mockResolvedValue(mockSecretConfig);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("handler.js", () => {
  it("should handle scheduled events to keep lambda warm", async () => {
    const event = {
      "detail-type": "Scheduled Event",
    };
    const result = await handler.handler(event);
    expect(result).toEqual({
      statusCode: 200,
      message: "Keep Lambda Warm",
    });
  });

  describe("getVoicemailDrop", () => {
    it("should get voicemail drop with contact id from ContactData", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailDrop",
          },
          ContactData: {
            ContactId: "test-contact-id",
            InitialContactId: "test-contact-id",
          },
        },
      };

      const mockResponse = { 
        recordingUrl: "https://s3.amazonaws.com/voicemail-recordings/standard-greeting.wav" 
      };
      api.getVoicemailDrop.mockResolvedValue(mockResponse);

      const result = await handler.handler(event);

      expect(api.getVoicemailDrop).toHaveBeenCalledWith(
        "test-contact-id",
        mockSecretConfig
      );
      expect(result).toEqual(mockResponse);
    });

    it("should get voicemail drop with contact id from Parameters", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailDrop",
            contactId: "custom-contact-id",
          },
          ContactData: {
            ContactId: "original-contact-id",
          },
        },
      };

      const mockResponse = { 
        recordingUrl: "https://s3.amazonaws.com/voicemail-recordings/standard-greeting.wav" 
      };
      api.getVoicemailDrop.mockResolvedValue(mockResponse);

      const result = await handler.handler(event);

      expect(api.getVoicemailDrop).toHaveBeenCalledWith(
        "custom-contact-id",
        mockSecretConfig
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle error when getting voicemail drop", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailDrop",
          },
          ContactData: {
            ContactId: "test-contact-id",
          },
        },
      };

      api.getVoicemailDrop.mockRejectedValue(new Error("Error getting voicemail drop"));

      await expect(handler.handler(event)).rejects.toThrow("Error getting voicemail drop");
    });
  });

  describe("getDefaultOutboundPhoneNumber", () => {
    it("should get default outbound phone number with agentARN from event Details Parameters", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getDefaultOutboundPhoneNumber",
            agentARN: "arn:aws:connect:us-east-1:123456789012:instance/xxx/agent/yyy",
          },
          ContactData: {
            ContactId: "test-contact-id",
          },
        },
      };

      const mockResponse = { phoneNumber: "+15551234567" };
      api.getDefaultOutboundPhoneNumber.mockResolvedValue(mockResponse);

      const result = await handler.handler(event);

      expect(api.getDefaultOutboundPhoneNumber).toHaveBeenCalledWith(
        "arn:aws:connect:us-east-1:123456789012:instance/xxx/agent/yyy",
        mockSecretConfig
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw when agentARN is missing for getDefaultOutboundPhoneNumber", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getDefaultOutboundPhoneNumber",
          },
          ContactData: {
            ContactId: "test-contact-id",
          },
        },
      };

      await expect(handler.handler(event)).rejects.toThrow(
        "agentARN is required for getDefaultOutboundPhoneNumber"
      );
      expect(api.getDefaultOutboundPhoneNumber).not.toHaveBeenCalled();
    });

    it("should handle error when getting default outbound phone number", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getDefaultOutboundPhoneNumber",
            agentARN: "arn:aws:connect:us-east-1:123456789012:instance/xxx/agent/yyy",
          },
          ContactData: {
            ContactId: "test-contact-id",
          },
        },
      };

      api.getDefaultOutboundPhoneNumber.mockRejectedValue(
        new Error("Error getting default outbound phone number")
      );

      await expect(handler.handler(event)).rejects.toThrow(
        "Error getting default outbound phone number"
      );
    });
  });

  describe("getVoicemailGreeting", () => {
    it("should get voicemail greeting with toPhoneNumber from ContactData.SystemEndpoint.Address", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailGreeting",
          },
          ContactData: {
            ContactId: "test-contact-id",
            SystemEndpoint: { Address: "+15553334444" },
          },
        },
      };

      const mockResponse = { greetingUrl: "https://s3.example.com/greeting.wav" };
      api.getVoicemailGreeting.mockResolvedValue(mockResponse);

      const result = await handler.handler(event);

      expect(api.getVoicemailGreeting).toHaveBeenCalledWith(
        "+15553334444",
        mockSecretConfig
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw when toPhoneNumber is missing for getVoicemailGreeting (no SystemEndpoint.Address)", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailGreeting",
          },
          ContactData: {
            ContactId: "test-contact-id",
          },
        },
      };

      await expect(handler.handler(event)).rejects.toThrow(
        "toPhoneNumber is required for getVoicemailGreeting"
      );
      expect(api.getVoicemailGreeting).not.toHaveBeenCalled();
    });

    it("should handle error when getting voicemail greeting", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailGreeting",
          },
          ContactData: {
            ContactId: "test-contact-id",
            SystemEndpoint: { Address: "+15551234567" },
          },
        },
      };

      api.getVoicemailGreeting.mockRejectedValue(
        new Error("Error getting voicemail greeting")
      );

      await expect(handler.handler(event)).rejects.toThrow(
        "Error getting voicemail greeting"
      );
    });
  });

  describe("secret configuration", () => {
    it("should use secret name from call attributes when provided", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailDrop",
          },
          ContactData: {
            ContactId: "test-contact-id",
            Attributes: {
              secretName: "custom-secret-name",
            },
          },
        },
      };

      api.getVoicemailDrop.mockResolvedValue({ recordingUrl: "test-url" });

      await handler.handler(event);

      expect(secretUtils.getSecretConfigs).toHaveBeenCalledWith("custom-secret-name");
    });

    it("should use secret name from fieldValues when provided", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailDrop",
            fieldValues: {
              secretName: "fieldValues-secret-name",
            },
          },
          ContactData: {
            ContactId: "test-contact-id",
          },
        },
      };

      api.getVoicemailDrop.mockResolvedValue({ recordingUrl: "test-url" });

      await handler.handler(event);

      expect(secretUtils.getSecretConfigs).toHaveBeenCalledWith("fieldValues-secret-name");
    });

    it("should fall back to environment variable when secret name not in attributes", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailDrop",
          },
          ContactData: {
            ContactId: "test-contact-id",
            Attributes: {},
          },
        },
      };

      api.getVoicemailDrop.mockResolvedValue({ recordingUrl: "test-url" });

      await handler.handler(event);

      expect(secretUtils.getSecretConfigs).toHaveBeenCalledWith("test-secret");
    });

    it("should throw error when secret name not provided anywhere", async () => {
      // Reset config to simulate missing environment variable
      config.secretName = undefined;

      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "getVoicemailDrop",
          },
          ContactData: {
            ContactId: "test-contact-id",
            Attributes: {},
          },
        },
      };

      await expect(handler.handler(event)).rejects.toThrow(
        "Secret name not provided in call attributes or SECRET_NAME environment variable"
      );

      // Restore config
      config.secretName = "test-secret";
    });
  });

  describe("unsupported method", () => {
    it("should throw error for unsupported method", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "unsupportedMethod",
          },
          ContactData: {
            ContactId: "test-contact-id",
          },
        },
      };

      await expect(handler.handler(event)).rejects.toThrow(
        "Unsupported method: unsupportedMethod"
      );
      expect(SCVLoggingUtil.warn).toHaveBeenCalledWith({
        message: "Unsupported method unsupportedMethod",
        context: {},
      });
    });
  });

  it("should log debug message for initial event", async () => {
    const event = {
      "detail-type": "Scheduled Event",
    };
    await handler.handler(event);
    expect(SCVLoggingUtil.debug).toHaveBeenCalledWith({
      message: "InvokeVfsIntegrationApi event received",
      context: { payload: event },
    });
  });

  it("should log successful response", async () => {
    const event = {
      "detail-type": "test",
      Details: {
        Parameters: {
          methodName: "getVoicemailDrop",
        },
        ContactData: {
          ContactId: "test-contact-id",
          InitialContactId: "test-contact-id",
        },
      },
    };
    const mockResponse = { recordingUrl: "test-url" };
    api.getVoicemailDrop.mockResolvedValue(mockResponse);
    await handler.handler(event);
    expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
      message: "Response received from VfsIntegrationService with test-contact-id",
      context: { contactId: "test-contact-id", payload: mockResponse },
    });
  });
});
