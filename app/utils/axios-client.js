import axios from "axios";

// Create axios instance
const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "",
    timeout: 300000,
    withCredentials: true,
});

// Response interceptor - redirect to login on 401
if (typeof window !== "undefined") {
    axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                // Don't redirect if already on login or error page
                const pathname = window.location.pathname;
                if (pathname !== "/auth/login" && pathname !== "/auth/error") {
                    const callbackUrl = encodeURIComponent(pathname);
                    window.location.href = `/auth/login?callbackUrl=${callbackUrl}`;
                }
            }
            return Promise.reject(error);
        },
    );
}

export default axiosInstance;
