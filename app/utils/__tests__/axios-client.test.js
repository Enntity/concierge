// Store interceptor handlers so we can test them
const interceptors = {
    response: { success: null, error: null },
};

// Mock axios to capture interceptors
jest.mock("axios", () => {
    const mockAxiosInstance = {
        interceptors: {
            request: { use: jest.fn() },
            response: {
                use: jest.fn((success, error) => {
                    interceptors.response.success = success;
                    interceptors.response.error = error;
                }),
            },
        },
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
    };

    return {
        create: jest.fn(() => mockAxiosInstance),
        default: mockAxiosInstance,
    };
});

let axiosClient;

describe("axiosClient", () => {
    beforeAll(() => {
        if (typeof window === "undefined") {
            global.window = {};
        }
        window.location = { pathname: "/", href: "" };
        axiosClient = require("../axios-client").default;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        delete window.location;
        window.location = { pathname: "/", href: "" };
    });

    describe("Response Interceptor", () => {
        it("should pass through successful responses", async () => {
            const response = { status: 200, data: { test: "data" } };
            const result = await interceptors.response.success(response);
            expect(result).toEqual(response);
        });

        it("should redirect to login on 401 error", async () => {
            window.location.pathname = "/chat";

            const error = { response: { status: 401 } };
            await expect(interceptors.response.error(error)).rejects.toEqual(
                error,
            );

            expect(window.location.href).toContain("/auth/login");
        });

        it("should not redirect if already on login page", async () => {
            window.location.pathname = "/auth/login";

            const error = { response: { status: 401 } };
            await expect(interceptors.response.error(error)).rejects.toEqual(
                error,
            );

            expect(window.location.href).toBe("");
        });

        it("should pass through non-401 errors", async () => {
            const error = { response: { status: 500 } };
            await expect(interceptors.response.error(error)).rejects.toEqual(
                error,
            );
        });
    });
});
