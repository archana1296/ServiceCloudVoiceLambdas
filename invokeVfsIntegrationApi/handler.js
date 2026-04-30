const SCVLoggingUtil = require("./SCVLoggingUtil");
const api = require("./vfsIntegrationApi");
const secretUtils = require("./secretUtils");
const config = require("./config");

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    message: "InvokeVfsIntegrationApi event received",
    context: { payload: event },
  });

  if (event["detail-type"] === "Scheduled Event") {
    return {
      statusCode: 200,
      message: "Keep Lambda Warm",
    };
  }

  let result = {};
  const { methodName, contactId, agentARN } = event.Details.Parameters;
  // for outbound calls, amazon creates 2 contact events when setDisconnectFlow block is hit. we need to take the one which is stored as vendorCallkey in the database.
  const contactIdValue = contactId || event.Details.ContactData.InitialContactId;
  // toPhoneNumber: from event only (number that was called = SystemEndpoint.Address)
  const toPhoneNumberValue = event.Details.ContactData?.SystemEndpoint?.Address;

  // Extract secret name from call attributes with precedence over environment variable
  const secretNameFromAttributes =
    event.Details.ContactData?.Attributes?.secretName ||
    event.Details.Parameters?.fieldValues?.secretName ||
    null;

  SCVLoggingUtil.debug({
    message: `Invoke ${methodName} request with ${contactIdValue}`,
    context: {
      contactId: contactIdValue,
      methodName: methodName,
      secretSource: secretNameFromAttributes ? "callAttributes" : "environment",
    },
  });

  // Determine the resolved secret name used (attributes takes precedence over environment)
  const resolvedSecretName = secretNameFromAttributes || config.secretName;
  if (!resolvedSecretName) {
    throw new Error(
      "Secret name not provided in call attributes or SECRET_NAME environment variable"
    );
  }

  // Get configuration from secret with proper key resolution
  const configData =
    (await secretUtils.getSecretConfigs(resolvedSecretName)) || {};

  switch (methodName) {
    case "getVoicemailDrop":
      result = await api.getVoicemailDrop(contactIdValue, configData);
      break;
    case "getDefaultOutboundPhoneNumber":
      if (!agentARN) {
        throw new Error("agentARN is required for getDefaultOutboundPhoneNumber");
      }
      result = await api.getDefaultOutboundPhoneNumber(agentARN, configData);
      break;
    case "getVoicemailGreeting":
      if (!toPhoneNumberValue) {
        throw new Error("toPhoneNumber is required for getVoicemailGreeting");
      }
      result = await api.getVoicemailGreeting(toPhoneNumberValue, configData);
      break;
    default:
      SCVLoggingUtil.warn({
        message: `Unsupported method ${methodName}`,
        context: {},
      });
      throw new Error(`Unsupported method: ${methodName}`);
  }

  SCVLoggingUtil.info({
    message: `Response received from VfsIntegrationService with ${contactIdValue}`,
    context: { contactId: contactIdValue, payload: result },
  });

  return result;
};
