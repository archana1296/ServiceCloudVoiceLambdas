const axios = require("axios");

// Mocking axios and axios-logger
jest.mock("axios");
jest.mock("axios-logger");

describe("API endpoints tests", () => {
    let endpoint;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.LOG_LEVEL = "debug"; // Default to 'debug' before each test to ensure the correct logic is applied

        // Mock axios.create to return objects with the correct structure (including `interceptors` with `use` methods)
        endpoint = {
            defaults: { baseURL: "https://api.salesforce.com" },
            interceptors: {
                request: {
                    handlers: [],
                    use: jest.fn((fulfilled, rejected) => {
                        endpoint.interceptors.request.handlers.push({ fulfilled, rejected });
                    }),
                },
                response: {
                    handlers: [],
                    use: jest.fn((fulfilled, rejected) => {
                        endpoint.interceptors.response.handlers.push({ fulfilled, rejected });
                    }),
                },
            },
        };

        // Mock axios.create to return our custom mock instances
        axios.create.mockImplementation(() => {
            return endpoint;
        });

        // Re-importing the module to trigger the interceptor setup
        require("../axiosWrapper.js"); // Replace with actual file name
    });

    it("should add interceptors when LOG_LEVEL is 'debug'", () => {
        process.env.LOG_LEVEL = "debug"; // Set the environment variable to 'debug'
        require("../axiosWrapper.js"); // Re-import to apply the change

        // Check if interceptors for both endpoints have been added to endpoint
        expect(endpoint.interceptors.request.handlers.length).toBe(2);
        expect(endpoint.interceptors.response.handlers.length).toBe(2);
    });

    it("should not add interceptors when LOG_LEVEL is not 'debug'", () => {
        process.env.LOG_LEVEL = "info"; // Set the environment variable to something other than 'debug'
        require("../axiosWrapper.js"); // Re-import to apply the change

        // Check that interceptors have not been added
        expect(endpoint.interceptors.request.handlers.length).toBe(0);
        expect(endpoint.interceptors.response.handlers.length).toBe(0);
    });
});
