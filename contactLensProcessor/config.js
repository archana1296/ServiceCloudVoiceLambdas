module.exports = {
  audience: "https://scrt.salesforce.com", // The audience specified in the claim of the generated JWT token.
  tokenValidFor: "15m", // JWT token valid duration.
  useSecretLambdaExtension: process.env.USE_SECRET_LAMBDA_EXTENSION === 'true',
};
