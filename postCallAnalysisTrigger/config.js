module.exports = {
  logLevel: process.env.LOG_LEVEL,
  secretName: process.env.SECRET_NAME,
  audience: "https://scrt.salesforce.com", // The audience specified in the claim of the generated JWT token.
  tokenValidFor: "15m", // JWT token valid duration
};
