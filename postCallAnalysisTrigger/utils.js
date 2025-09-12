const jwt = require("jsonwebtoken");
const uuid = require("uuid/v1");
const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const secretUtils = require("./secretUtils");

const connect = new aws.Connect();

async function getAgentTimestamp(describeContactParams) {
  try {
    const describeContactResponse = await connect
      .describeContact(describeContactParams)
      .promise();
    SCVLoggingUtil.info({
      message:
        "Successfully fetched the result from the describeContact API call.",
      eventType: "SIGNALS",
      category: "describeContactResponse",
      context: describeContactResponse,
    });
    return describeContactResponse;
  } catch (err) {
    const message = `Error fetching the result from the describeContact API call!`;
    SCVLoggingUtil.error({
      category: [],
      eventType: "SIGNALS",
      message,
      context: err,
    });
    throw new Error(message);
  }
}

async function generateJWT() {
  const configData = await secretUtils.getSecretConfigs(config.secretName);
  const signOptions = {
    issuer: configData.salesforceOrgId,
    subject: configData.callCenterApiName,
    audience: config.audience,
    expiresIn: config.tokenValidFor,
    algorithm: "RS256",
    jwtid: uuid(),
  };

  return jwt.sign({}, configData.privateKey, signOptions);
}

function sentimentNormalizer(sentiment) {
  const message = `Error converting sentiment type into score!`;
  switch (sentiment) {
    case "POSITIVE":
      return 1000;
    case "MIXED":
    case "NEUTRAL":
      return 0;
    case "NEGATIVE":
      return -1000;
    default:
      SCVLoggingUtil.error({
        category: "Converting sentiment type into score",
        eventType: "SIGNALS",
        message: `The postCallAnalysisTrigger Lambda function can't convert the sentiment type ${sentiment} to a score because the type isn't valid. Valid sentiment types are POSITIVE, NEGATIVE, MIXED, and NEUTRAL.`,
        context: sentiment,
      });
      throw new Error(message);
  }
}

/**
 * Slice large signal array into smaller chunks to fit in predefined batchSize
 */
function sliceIntoChunks(arr, chunkSize) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}

/**
 * Validate S3 key has the correct format
 */
function validateS3KeyName(key) {
  // Redacted file should be filtered
  if (key.includes("Redacted")) {
    SCVLoggingUtil.error({
      category: "Unsupported file directory",
      eventType: "SIGNALS",
      message:
        "The postCallAnalysisTrigger Lambda function can't process redacted files. Verify that the directory in the EventbBridge rule points to unredacted files only.",
      context: key,
    });
    return false;
  }

  // prefix regex format: Analysis/Voice/####/##/##/{contactId}_*.json
  const prefixRegex =
    /^(Analysis\/Voice\/)[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[a-z0-9-]{36}(.*?)(.json)$/;
  if (key.search(prefixRegex) === -1) {
    SCVLoggingUtil.error({
      category: "Unsupported file name",
      eventType: "SIGNALS",
      message: `The file type of the post-call analysis input file (${key}) isn't valid. The postCallAnalysisTrigger Lambda function processes .json files only.`,
      context: key,
    });
    return false;
  }

  return true;
}

module.exports = {
  generateJWT,
  getAgentTimestamp,
  sentimentNormalizer,
  sliceIntoChunks,
  validateS3KeyName,
};
