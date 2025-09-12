module.exports = {
  // JWT token valid duration
  tokenValidFor: "3m",
  secretName: process.env.SECRET_NAME,
  accessTokenSecretName: process.env.ACCESS_SECRET_NAME,
};
