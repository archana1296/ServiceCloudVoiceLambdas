const handler = require("../handler");

jest.mock("../SCVLoggingUtil");
const SCVLoggingUtil = require("../SCVLoggingUtil");

jest.mock("../telephonyIntegrationApi");
const api = require("../telephonyIntegrationApi");

jest.mock("../secretUtils");
const secretUtils = require("../secretUtils");

jest.mock("../config");
const config = require("../config");

jest.mock("../utils");
const utils = require("../utils");

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

    describe("createVoiceCall", () => {
      it("should create voice call with PSTN parameters", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "createVoiceCall",
            },
            ContactData: {
              ContactId: "test-contact-id",
              SegmentAttributes: {
                "connect:Subtype": { ValueString: "connect:PSTN" },
              },
              Attributes: {
                "sfdc-attr1": "value1",
              },
              CustomerEndpoint: { Address: "customer-endpoint" },
              SystemEndpoint: { Address: "system-endpoint" },
            },
          },
        };
        const mockCallAttributes = JSON.stringify({ attr1: "value1" });
        utils.getCallAttributes.mockReturnValue(mockCallAttributes);
        api.createVoiceCall.mockResolvedValue({ voiceCallRecordId: "test-id" });

        const result = await handler.handler(event);

        expect(api.createVoiceCall).toHaveBeenCalledWith({
          callCenterApiName: "test-call-center",
          vendorCallKey: "test-contact-id",
          to: "system-endpoint",
          from: "customer-endpoint",
          initiationMethod: "Inbound",
          startTime: expect.any(String),
          callSubtype: "PSTN",
          callAttributes: mockCallAttributes,
          participants: [
            {
              participantKey: "customer-endpoint",
              type: "END_USER",
            },
          ],
        }, mockSecretConfig);
        expect(result).toEqual({ voiceCallRecordId: "test-id" });
      });

      it("should create voice call with WebRTC parameters", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "createVoiceCall",
            },
            ContactData: {
              ContactId: "test-contact-id",
              SegmentAttributes: {
                "connect:Subtype": { ValueString: "connect:WebRTC" },
              },
              Attributes: {
                WebRTC_From: "webrtc-from",
                WebRTC_To: "webrtc-to",
              },
              CustomerEndpoint: { Address: "customer-endpoint" },
              SystemEndpoint: { Address: "system-endpoint" },
            },
          },
        };

        utils.getCallAttributes.mockReturnValue("{}");
        api.createVoiceCall.mockResolvedValue({ voiceCallRecordId: "test-id" });

        const result = await handler.handler(event);

        expect(api.createVoiceCall).toHaveBeenCalledWith(
          expect.objectContaining({
            from: "webrtc-from",
            to: "webrtc-to",
            callSubtype: "WebRTC",
            participants: [
              {
                participantKey: "WebRTC_Default",
                type: "END_USER",
              },
            ],
          }),
          mockSecretConfig
        );
      });

      it("should use WebRTC_Default when WebRTC attributes are missing", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "createVoiceCall",
            },
            ContactData: {
              ContactId: "test-contact-id",
              SegmentAttributes: {
                "connect:Subtype": { ValueString: "connect:WebRTC" },
              },
              Attributes: {},
              CustomerEndpoint: {},
              SystemEndpoint: {},
            },
          },
        };

        utils.getCallAttributes.mockReturnValue("{}");
        api.createVoiceCall.mockResolvedValue({ voiceCallRecordId: "test-id" });

        await handler.handler(event);

        expect(api.createVoiceCall).toHaveBeenCalledWith(
          expect.objectContaining({
            from: "WebRTC_Default",
            to: "WebRTC_Default",
            callSubtype: "WebRTC",
          }),
          mockSecretConfig
        );
      });

      it("should use provided contactId from parameters", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "createVoiceCall",
              contactId: "custom-contact-id",
            },
            ContactData: {
              ContactId: "original-contact-id",
              SegmentAttributes: {
                "connect:Subtype": { ValueString: "connect:PSTN" },
              },
              Attributes: {},
              CustomerEndpoint: { Address: "customer-endpoint" },
              SystemEndpoint: { Address: "system-endpoint" },
            },
          },
        };

        utils.getCallAttributes.mockReturnValue("{}");
        api.createVoiceCall.mockResolvedValue({ voiceCallRecordId: "test-id" });

        await handler.handler(event);

        expect(api.createVoiceCall).toHaveBeenCalledWith(
          expect.objectContaining({
            vendorCallKey: "custom-contact-id",
          }),
          mockSecretConfig
        );
      });
    });

    describe("updateVoiceCall", () => {
      it("should update voice call with correct parameters", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "updateVoiceCall",
              fieldValues: {
                status: "completed",
              },
            },
            ContactData: {
              ContactId: "test-contact-id",
            },
          },
        };
        api.updateVoiceCall.mockResolvedValue({ success: true });
        const result = await handler.handler(event);
        expect(api.updateVoiceCall).toHaveBeenCalledWith("test-contact-id", {
          status: "completed",
          callCenterApiName: "test-call-center",
        }, mockSecretConfig);
        expect(result).toEqual({ success: true });
      });
    });

    describe("createTransferVC", () => {
      it("should create transfer voice call with queue", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "createTransferVC",
            },
            ContactData: {
              ContactId: "test-contact-id",
              PreviousContactId: "previous-contact-id",
              Attributes: {
                "sfdc-attr1": "value1",
              },
              CustomerEndpoint: { Address: "customer-endpoint" },
              SystemEndpoint: { Address: "system-endpoint" },
              Queue: { ARN: "test-queue-arn" },
            },
          },
        };
        const mockCallAttributes = JSON.stringify({ attr1: "value1" });
        utils.getCallAttributes.mockReturnValue(mockCallAttributes);
        api.createVoiceCall.mockResolvedValue({
          voiceCallRecordId: "transfer-id",
        });
        const result = await handler.handler(event);

        expect(api.createVoiceCall).toHaveBeenCalledWith({
          callCenterApiName: "test-call-center",
          vendorCallKey: "test-contact-id",
          to: "system-endpoint",
          from: "customer-endpoint",
          parentVoiceCallId: "previous-contact-id",
          initiationMethod: "Transfer",
          startTime: expect.any(String),
          callAttributes: mockCallAttributes,
          participants: [
            {
              participantKey: "customer-endpoint",
              type: "END_USER",
            },
          ],
          queue: "test-queue-arn",
        }, mockSecretConfig);
        expect(result).toEqual({ voiceCallRecordId: "transfer-id" });
      });

      it("should create transfer voice call without queue when not provided", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "createTransferVC",
            },
            ContactData: {
              ContactId: "test-contact-id",
              PreviousContactId: "previous-contact-id",
              Attributes: {},
              CustomerEndpoint: { Address: "customer-endpoint" },
              SystemEndpoint: { Address: "system-endpoint" },
            },
          },
        };

        utils.getCallAttributes.mockReturnValue("{}");
        api.createVoiceCall.mockResolvedValue({
          voiceCallRecordId: "transfer-id",
        });

        const result = await handler.handler(event);

        expect(api.createVoiceCall).toHaveBeenCalledWith(
          expect.not.objectContaining({
            queue: expect.anything(),
          }),
          mockSecretConfig
        );
      });
    });

    describe("executeOmniFlow", () => {
      it("should execute omni flow with dialed number from fieldValues", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "executeOmniFlow",
              flowDevName: "TestFlow",
              fallbackQueue: "TestQueue",
              fieldValues: {
                dialedNumber: "123-456-7890",
              },
              "flowInput-param1": "value1",
              "flowInput-param2": "value2",
            },
            ContactData: {
              ContactId: "test-contact-id",
            },
          },
        };
        const mockFlowInputParams = { param1: "value1", param2: "value2" };
        utils.constructFlowInputParams.mockReturnValue(mockFlowInputParams);
        api.executeOmniFlow.mockResolvedValue({ flowExecutionId: "flow-id" });
        const result = await handler.handler(event);
        expect(utils.constructFlowInputParams).toHaveBeenCalledWith(
          event.Details.Parameters
        );
        expect(api.executeOmniFlow).toHaveBeenCalledWith("test-contact-id", {
          flowDevName: "TestFlow",
          fallbackQueue: "TestQueue",
          dialedNumber: "123-456-7890",
          flowInputParameters: mockFlowInputParams,
        }, mockSecretConfig);
        expect(result).toEqual({ flowExecutionId: "flow-id" });
      });

      it("should use system endpoint address when dialedNumber not in fieldValues", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "executeOmniFlow",
              flowDevName: "TestFlow",
              fallbackQueue: "TestQueue",
            },
            ContactData: {
              ContactId: "test-contact-id",
              SystemEndpoint: { Address: "system-dialed-number" },
            },
          },
        };

        utils.constructFlowInputParams.mockReturnValue({});
        api.executeOmniFlow.mockResolvedValue({ flowExecutionId: "flow-id" });

        await handler.handler(event);

        expect(api.executeOmniFlow).toHaveBeenCalledWith("test-contact-id", {
          flowDevName: "TestFlow",
          fallbackQueue: "TestQueue",
          dialedNumber: "system-dialed-number",
          flowInputParameters: {},
        }, mockSecretConfig);
      });
    });

    describe("cancelOmniFlowExecution", () => {
      it("should cancel omni flow execution", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "cancelOmniFlowExecution",
            },
            ContactData: {
              ContactId: "test-contact-id",
            },
          },
        };
        api.cancelOmniFlowExecution.mockResolvedValue({ success: true });
        const result = await handler.handler(event);
        expect(api.cancelOmniFlowExecution).toHaveBeenCalledWith(
          "test-contact-id",
          mockSecretConfig
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe("rerouteFlowExecution", () => {
      it("should reroute flow execution", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "rerouteFlowExecution",
            },
            ContactData: {
              ContactId: "test-contact-id",
            },
          },
        };
        api.rerouteFlowExecution.mockResolvedValue({ success: true });
        const result = await handler.handler(event);
        expect(api.rerouteFlowExecution).toHaveBeenCalledWith(
          "test-contact-id",
          mockSecretConfig
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe("sendMessage", () => {
      it("should send message with correct parameters", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "sendMessage",
              fieldValues: {
                message: "Test message",
              },
            },
            ContactData: {
              ContactId: "test-contact-id",
            },
          },
        };
        api.sendMessage.mockResolvedValue({ messageId: "msg-id" });
        const result = await handler.handler(event);
        expect(api.sendMessage).toHaveBeenCalledWith("test-contact-id", {
          message: "Test message",
          callCenterApiName: "test-call-center",
        }, mockSecretConfig);
        expect(result).toEqual({ messageId: "msg-id" });
      });
    });

    describe("callbackExecution", () => {
      it("should execute callback with customer callback number", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "callbackExecution",
              customerCallbackNumber: "123-456-7890",
            },
            ContactData: {
              ContactId: "test-contact-id",
            },
          },
        };
        api.callbackExecution.mockResolvedValue({ callbackId: "callback-id" });
        const result = await handler.handler(event);
        expect(api.callbackExecution).toHaveBeenCalledWith("test-contact-id", {
          callbackNumber: "123-456-7890",
        }, mockSecretConfig);
        expect(result).toEqual({ callbackId: "callback-id" });
      });
    });

    describe("secret configuration", () => {
      it("should use secret name from call attributes when provided", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "cancelOmniFlowExecution",
            },
            ContactData: {
              ContactId: "test-contact-id",
              Attributes: {
                secretName: "custom-secret-name",
              },
            },
          },
        };

        api.cancelOmniFlowExecution.mockResolvedValue({ success: true });

        await handler.handler(event);

        expect(secretUtils.getSecretConfigs).toHaveBeenCalledWith("custom-secret-name");
      });

      it("should use access secret name from call attributes when provided", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "createVoiceCall",
            },
            ContactData: {
              ContactId: "test-contact-id",
              SegmentAttributes: {
                "connect:Subtype": { ValueString: "connect:PSTN" },
              },
              Attributes: {
                secretName: "custom-secret-name",
                accessSecretName: "custom-access-secret-name",
              },
              CustomerEndpoint: { Address: "customer-endpoint" },
              SystemEndpoint: { Address: "system-endpoint" },
            },
          },
        };

        utils.getCallAttributes.mockReturnValue("{}");
        api.createVoiceCall.mockResolvedValue({ voiceCallRecordId: "test-id" });

        await handler.handler(event);

        expect(secretUtils.getSecretConfigs).toHaveBeenCalledWith("custom-secret-name");
      });

      it("should use secret name from fieldValues when provided", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "cancelOmniFlowExecution",
              fieldValues: {
                secretName: "fieldValues-secret-name",
              },
            },
            ContactData: {
              ContactId: "test-contact-id",
            },
          },
        };

        api.cancelOmniFlowExecution.mockResolvedValue({ success: true });

        await handler.handler(event);

        expect(secretUtils.getSecretConfigs).toHaveBeenCalledWith("fieldValues-secret-name");
      });

      it("should fall back to environment variable when secret name not in attributes", async () => {
        const event = {
          "detail-type": "test",
          Details: {
            Parameters: {
              methodName: "cancelOmniFlowExecution",
            },
            ContactData: {
              ContactId: "test-contact-id",
              Attributes: {},
            },
          },
        };

        api.cancelOmniFlowExecution.mockResolvedValue({ success: true });

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
              methodName: "cancelOmniFlowExecution",
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
        message: "InvokeTelephonyIntegrationApi event received",
        context: { payload: event },
      });
    });

    it("should log successful response", async () => {
      const event = {
        "detail-type": "test",
        Details: {
          Parameters: {
            methodName: "cancelOmniFlowExecution",
          },
          ContactData: {
            ContactId: "test-contact-id",
          },
        },
      };
      const mockResponse = { success: true };
      api.cancelOmniFlowExecution.mockResolvedValue(mockResponse);
      await handler.handler(event);
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: "Response received from TelephonyService with test-contact-id",
        context: { contactId: "test-contact-id", payload: mockResponse },
      });
    });
});