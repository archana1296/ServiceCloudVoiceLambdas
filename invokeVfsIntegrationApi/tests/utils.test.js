const utils = require("../utils");
const jwt = require("jsonwebtoken");
const uuid = require("uuid/v1");

jest.mock("jsonwebtoken", () => {
  const sign = jest.fn().mockReturnValue("mock.jwt.token");
  return { sign };
});
jest.mock("uuid/v1", () => jest.fn().mockReturnValue("mock-uuid"));

describe("utils.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generateJWT returns a JWT token", async () => {
    const params = {
      orgId: "testOrgId",
      callCenterApiName: "testCallCenter",
      expiresIn: "1h",
      privateKey: "testPrivateKey",
    };
    const result = await utils.generateJWT(params);
    expect(typeof result).toBe("string");
  });

  it("generateJWT calls jwt.sign with correct parameters", async () => {
    const params = {
      orgId: "testOrgId",
      callCenterApiName: "testCallCenter",
      expiresIn: "1h",
      privateKey: "testPrivateKey",
    };
    await utils.generateJWT(params);
    expect(jwt.sign).toHaveBeenCalledWith(
      {},
      params.privateKey,
      expect.objectContaining({
        issuer: params.orgId,
        subject: params.callCenterApiName,
        expiresIn: params.expiresIn,
        algorithm: "RS256",
      })
    );
  });

  it("generateJWT uses uuid for jwtid", async () => {
    const params = {
      orgId: "testOrgId",
      callCenterApiName: "testCallCenter",
      expiresIn: "5m",
      privateKey: "testPrivateKey",
    };
    await utils.generateJWT(params);
    expect(uuid).toHaveBeenCalledTimes(1);
    expect(jwt.sign).toHaveBeenCalledWith(
      {},
      params.privateKey,
      expect.objectContaining({
        jwtid: "mock-uuid",
      })
    );
  });

  it("generateJWT handles different expiresIn values", async () => {
    const params = {
      orgId: "testOrgId",
      callCenterApiName: "testCallCenter",
      expiresIn: "10m",
      privateKey: "testPrivateKey",
    };
    await utils.generateJWT(params);
    expect(jwt.sign).toHaveBeenCalledWith(
      {},
      params.privateKey,
      expect.objectContaining({
        expiresIn: "10m",
      })
    );
  });
});
