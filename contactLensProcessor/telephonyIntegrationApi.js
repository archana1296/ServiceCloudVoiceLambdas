const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");
const secretUtils = require("./secretUtils");

const vendorFQN = "amazon-connect";

// Retry configuration for Conversation Service rate limiting
// CS rate limit window is 30 seconds, so retry delays sum to 35s to guarantee new window
const RETRY_DELAYS = [5000, 10000, 20000];
const MAX_RETRIES = 3;

function generateJWTParams(secretData) {
  return {
    orgId: secretData.orgId,
    callCenterApiName: secretData.callCenterApiName,
    expiresIn: secretData.tokenValidFor,
    privateKey: secretData.privateKey,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract vendorCallKeys of entries that were rate-limited by Conversation Service.
 *
 * The telephony service returns HTTP 207 (MULTI_STATUS) with per-entry errors.
 * Rate-limited entries have RESOURCE_EXHAUSTED in the error message (from gRPC status)
 * but the per-entry status is incorrectly set to 400 instead of 429.
 */
function getRateLimitedKeys(responseData) {
  const errorEntries = responseData?.errorResponse?.errorResponseEntries;
  if (!errorEntries || !Array.isArray(errorEntries)) return [];

  return errorEntries
    .filter(entry => entry.message && entry.message.includes("RESOURCE_EXHAUSTED"))
    .map(entry => entry.vendorCallKey);
}

/**
 * Classify the bulk endpoint response and determine the next action.
 *
 * 202 = all entries accepted (success)
 * 207 = partial failure; check per-entry errors for RESOURCE_EXHAUSTED
 */
function classifyBulkResponse(response) {
  if (response.status === 202) {
    return { action: 'success' };
  }

  const rateLimitedKeys = getRateLimitedKeys(response.data);
  if (rateLimitedKeys.length === 0) {
    return { action: 'done' };
  }

  return { action: 'retry', rateLimitedKeys };
}

async function invokeBulkApi(axiosInstance, entries, headers) {
  return axiosInstance.post(
    `/voiceCalls/messages`,
    { entries },
    { headers }
  );
}

function handleSuccess(response) {
  SCVLoggingUtil.info({
    message: "Successfully sent bulk transcripts",
    context: {
      payload: { statusText: response.statusText, statusCode: response.status },
    },
  });
  return { shouldContinue: false };
}

function handleDone(response) {
  SCVLoggingUtil.info({
    message: "Bulk transcripts partially sent (non-rate-limit errors)",
    context: {
      payload: { statusText: response.statusText, statusCode: response.status },
    },
  });
  return { shouldContinue: false };
}

function handleRetry(response, result, attempt) {
  const { rateLimitedKeys } = result;

  if (attempt >= MAX_RETRIES) {
    SCVLoggingUtil.error({
      message: "Rate limited entries remain after all retries exhausted",
      context: { rateLimitedKeys, totalRetries: MAX_RETRIES },
    });
    return { shouldContinue: false };
  }

  const delay = RETRY_DELAYS[attempt];
  SCVLoggingUtil.info({
    message: `Rate limited by Conversation Service (RESOURCE_EXHAUSTED). `
      + `Retrying ${rateLimitedKeys.length} entries in ${delay / 1000}s. `
      + `Retry ${attempt + 1}/${MAX_RETRIES}`,
    context: { rateLimitedKeys, attempt: attempt + 1 },
  });

  return { shouldContinue: true, delay, rateLimitedKeys };
}

const actionHandlers = {
  success: handleSuccess,
  done: handleDone,
  retry: handleRetry,
};

async function retryRateLimitedEntries(axiosInstance, allEntries, rateLimitedKeys, headers) {
  let keysToRetry = rateLimitedKeys;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await sleep(RETRY_DELAYS[attempt]);
    const entriesToSend = allEntries.filter(
      entry => keysToRetry.includes(entry.vendorCallKey)
    );

    const response = await invokeBulkApi(axiosInstance, entriesToSend, headers);
    const result = classifyBulkResponse(response);
    const handler = actionHandlers[result.action];
    const outcome = handler(response, result, attempt + 1);

    if (!outcome.shouldContinue) return;
    keysToRetry = outcome.rateLimitedKeys;
  }
}

async function sendMessagesInBulk(payload) {
  SCVLoggingUtil.info({
    message: "Creating sendMessagesInBulk request",
    context: { payload: payload },
  });
  const secretData = await secretUtils.getSecretConfigs(payload.secretName);
  const jwt = await utils.generateJWT(generateJWTParams(secretData));
  delete payload.secretName;

  const axiosInstance = axiosWrapper.getScrtEndpoint(secretData);
  const headers = {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
    "Telephony-Provider-Name": vendorFQN,
  };

  try {
    const response = await invokeBulkApi(axiosInstance, payload.entries, headers);
    const result = classifyBulkResponse(response);
    const handler = actionHandlers[result.action];
    const outcome = handler(response, result, 0);

    if (outcome.shouldContinue) {
      await retryRateLimitedEntries(axiosInstance, payload.entries, outcome.rateLimitedKeys, headers);
    }
  } catch (error) {
    SCVLoggingUtil.error({
      message: "Error sending transcripts in bulk",
      context: error,
    });
  }

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
  // Exported for testing
  classifyBulkResponse,
  getRateLimitedKeys,
  RETRY_DELAYS,
  MAX_RETRIES,
};
