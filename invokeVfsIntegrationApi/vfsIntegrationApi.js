const SCVLoggingUtil = require("./SCVLoggingUtil");
const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");

const vendorFQN = "amazon-connect";

/**
 * Get voicemail drop recording URL for a VoiceCall.
 *
 * @param {string} contactId - The vendor-specific ID or the SObject ID of the VoiceCall record.
 * @param {object} configData - Configuration data containing orgId, callCenterApiName, privateKey, etc.
 *
 * @return {object} result.recordingUrl - The URL of the voicemail drop recording.
 */
async function getVoicemailDrop(contactId, configData) {
  SCVLoggingUtil.info({
    message: "getVoicemailDrop Request created",
    context: { contactId: contactId },
  });

  const generateJWTParams = {
    orgId: configData.orgId,
    callCenterApiName: configData.callCenterApiName,
    expiresIn: configData.tokenValidFor,
    privateKey: configData.privateKey,
  };

  const jwt = await utils.generateJWT(generateJWTParams);

  try {
    const responseVal = await axiosWrapper
      .getScrtEndpoint(configData)
      .get(`/voiceCalls/${contactId}/voicemailDrop`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          "Telephony-Provider-Name": vendorFQN,
        },
      });

    SCVLoggingUtil.info({
      message: `Successfully retrieved voicemail drop for ${contactId}`,
      context: { payload: responseVal },
    });
    return responseVal.data;
  } catch (error) {
    if (error.response?.status === 404) {
      SCVLoggingUtil.info({
        message: `Voicemail drop not found for ${contactId}`,
        context: { contactId },
      });
      return { recordingUrl: "Not found" };
    }
    SCVLoggingUtil.error({
      message: `Error getting voicemail drop for ${contactId}`,
      context: { payload: error },
    });
    throw new Error("Error getting voicemail drop");
  }
}

/**
 * Get default outbound phone number by external rep id (agent ARN).
 *
 * @param {string} externalRepId - The agent ARN (external rep id).
 * @param {object} configData - Configuration data containing orgId, callCenterApiName, privateKey, etc.
 *
 * @return {object} Response data from the endpoint.
 */
async function getDefaultOutboundPhoneNumber(externalRepId, configData) {
  SCVLoggingUtil.info({
    message: "getDefaultOutboundPhoneNumber Request created",
    context: { externalRepId: externalRepId },
  });

  const generateJWTParams = {
    orgId: configData.orgId,
    callCenterApiName: configData.callCenterApiName,
    expiresIn: configData.tokenValidFor,
    privateKey: configData.privateKey,
  };

  const jwt = await utils.generateJWT(generateJWTParams);

  const url = `/voiceCalls/defaultOutboundPhoneNumber?externalRepId=${encodeURIComponent(externalRepId)}`;
  try {
    const responseVal = await axiosWrapper
      .getScrtEndpoint(configData)
      .get(url, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          "Telephony-Provider-Name": vendorFQN,
        },
      });

    SCVLoggingUtil.info({
      message: "Successfully retrieved default outbound phone number",
      context: { payload: responseVal },
    });
    return responseVal.data;
  } catch (error) {
    SCVLoggingUtil.error({
      message: "Error getting default outbound phone number",
      context: { payload: error },
    });
    throw new Error("Error getting default outbound phone number");
  }
}

/**
 * Get voicemail greeting for a phone number.
 *
 * @param {string} toPhoneNumber - The phone number to get the voicemail greeting for.
 * @param {object} configData - Configuration data containing orgId, callCenterApiName, privateKey, etc.
 *
 * @return {object} Response data from the endpoint.
 */
async function getVoicemailGreeting(toPhoneNumber, configData) {
  SCVLoggingUtil.info({
    message: "getVoicemailGreeting Request created",
    context: { toPhoneNumber: toPhoneNumber },
  });

  const generateJWTParams = {
    orgId: configData.orgId,
    callCenterApiName: configData.callCenterApiName,
    expiresIn: configData.tokenValidFor,
    privateKey: configData.privateKey,
  };

  const jwt = await utils.generateJWT(generateJWTParams);

  const url = `/voiceCalls/voicemailGreeting?toPhoneNumber=${encodeURIComponent(toPhoneNumber)}`;
  try {
    const responseVal = await axiosWrapper
      .getScrtEndpoint(configData)
      .get(url, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          "Telephony-Provider-Name": vendorFQN,
        },
      });

    SCVLoggingUtil.info({
      message: "Successfully retrieved voicemail greeting",
      context: { payload: responseVal },
    });
    return responseVal.data;
  } catch (error) {
    SCVLoggingUtil.error({
      message: "Error getting voicemail greeting",
      context: { payload: error },
    });
    throw new Error("Error getting voicemail greeting");
  }
}

module.exports = {
  getVoicemailDrop,
  getDefaultOutboundPhoneNumber,
  getVoicemailGreeting,
};
