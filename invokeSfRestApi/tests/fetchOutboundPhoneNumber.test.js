const { fetchOutboundPhoneNumber } = require("./../fetchOutboundPhoneNumber");

jest.mock("./../queryEngine");
const queryEngine = require("./../queryEngine");

jest.mock("../secretUtils");
const secretUtils = require("../secretUtils.js");

describe("fetchOutboundPhoneNumber", () => {
  it("failure in fetching number due to missing agent arn", async () => {
    const event = {
      Details: {
        Parameters: {},
      },
    };
    const configs = {
      callCenterApiName: "callCenterApiNameVal",
      baseURL: "baseURLVal",
      authEndpoint: "authEndpointVal",
      consumerKey: "consumerKeyVal",
      privateKey: "privateKeyVal",
      audience: "audienceVal",
      subject: "subjectVal"
    };

    secretUtils.getSecretConfigs.mockImplementationOnce(() => Promise.resolve(configs));
    const { outboundPhoneNumber, success } = await fetchOutboundPhoneNumber(
      event
    );
    expect(outboundPhoneNumber).toBeUndefined();
    expect(success).toBeTruthy();
  });

  it("failure in fetching number due to failure in querying messaging channel", async () => {
    const agentARN = `testAgentARN`;
    const event = {
      Details: {
        Parameters: {
          agentARN,
        },
      },
    };
    const configs = {
      callCenterApiName: "callCenterApiNameVal",
      baseURL: "baseURLVal",
      authEndpoint: "authEndpointVal",
      consumerKey: "consumerKeyVal",
      privateKey: "privateKeyVal",
      audience: "audienceVal",
      subject: "subjectVal"
    };

    secretUtils.getSecretConfigs.mockImplementationOnce(() => Promise.resolve(configs));

    queryEngine.invokeQuery.mockImplementation(() => Promise.reject({}));

    const { outboundPhoneNumber, success } = await fetchOutboundPhoneNumber(
      event
    );
    expect(outboundPhoneNumber).toBeUndefined();
    expect(success).toBeTruthy();
  });

  it("Fetching outbound number for a valid agentARN", async () => {
    const agentARN = `testAgentARN`;
    const MessagingPlatformKey = "123456789";

    const event = {
      Details: {
        Parameters: {
          agentARN,
        },
      },
    };

    queryEngine.invokeQuery.mockImplementation(() =>
      Promise.resolve({
        MessagingPlatformKey,
      })
    );
    const { outboundPhoneNumber, success } = await fetchOutboundPhoneNumber(
      event
    );
    expect(MessagingPlatformKey).toEqual(outboundPhoneNumber);
    expect(success).toBeTruthy();
  });
});
