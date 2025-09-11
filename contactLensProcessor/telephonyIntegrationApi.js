const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");
const secretUtils = require("./secretUtils");

const vendorFQN = "amazon-connect";

function generateJWTParams(secretData) {
  return {
    orgId: secretData.orgId,
    callCenterApiName: secretData.callCenterApiName,
    expiresIn: secretData.tokenValidFor,
    privateKey: secretData.privateKey,
  };
}

async function sendMessagesInBulk(payload) {
  SCVLoggingUtil.info({
    message: "Creating sendMessagesInBulk request",
    context: { payload: payload },
  });
  const secretData = await secretUtils.getSecretConfigs(payload.secretName)
  const jwt = await utils.generateJWT(generateJWTParams(secretData));
  // we have read the secretName. So removing this from payload.
  delete payload.secretName
  await axiosWrapper.getScrtEndpoint(secretData)
    .post(`/voiceCalls/messages`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    })
    .then((response) => {
      SCVLoggingUtil.info({
        message: "Successfully sent bulk transcripts",
        context: {
          payload: {
            statusText: response.statusText,
            statusCode: response.statusCode,
          },
        },
      });
    })
    .catch((error) => {
      SCVLoggingUtil.error({
        message: "Error sending transcripts in bulk",
        context: error,
      });

      if (error.response.status === 429) {
        return { data: { result: "Error" } };
      }
    });
  return { data: { result: "Success" } };
}

async function sendRealtimeConversationEvents(contactId, payload, secretName) {
  SCVLoggingUtil.info({
    message: "Creating sendRealtimeConversationEvents request",
    context: { contactId: contactId },
  });
  const secretData = await secretUtils.getSecretConfigs(secretName)
  const jwt = await utils.generateJWT(generateJWTParams(secretData));

  await axiosWrapper.getScrtEndpoint(secretData)
    .post(`/voiceCalls/${contactId}/realtimeConversationEvents`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    })
    .then((response) => {
      SCVLoggingUtil.info({
        message: "Successfully sent realtimeConversationEvents",
        context: {
          payload: {
            statusText: response.statusText,
            statusCode: response.statusCode,
          },
        },
      });
    })
    .catch((error) => {
      SCVLoggingUtil.error({
        message: "Error sending realtime conversationevents",
        context: error,
      });
      // Do not throw error; failing lambda execution will keep Kinesis records in stream
    });

  return { data: { result: "Success" } };
}

module.exports = {
  sendMessagesInBulk,
  sendRealtimeConversationEvents,
};
