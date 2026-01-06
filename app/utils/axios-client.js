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
                // Don't redirect if already on login page
                if (window.location.pathname !== "/auth/login") {
                    const callbackUrl = encodeURIComponent(
                        window.location.pathname,
                    );
                    window.location.href = `/auth/login?callbackUrl=${callbackUrl}`;
                }
            }
            return Promise.reject(error);
        },
    );
}

export default axiosInstance;
