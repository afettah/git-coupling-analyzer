import axios from 'axios';

export const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// === Global Error Handling ===

export interface ApiErrorInfo {
    code: string;
    message: string;
    details?: any;
    status: number;
}

client.interceptors.response.use(
    (response) => response,
    (error) => {
        const errorInfo: ApiErrorInfo = {
            code: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred',
            status: error.response?.status || 500,
        };

        if (error.response && error.response.data && error.response.data.error) {
            const apiError = error.response.data.error;
            errorInfo.code = apiError.code;
            errorInfo.message = apiError.message;
            errorInfo.details = apiError.details;
        } else if (error.message) {
            errorInfo.message = error.message;
        }

        // Dispatch a global event for the UI to handle
        window.dispatchEvent(new CustomEvent('api-error', { detail: errorInfo }));

        return Promise.reject(errorInfo);
    }
);
