import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { ApiErrorInfo } from '../api/git';

interface ErrorItem extends ApiErrorInfo {
    id: string;
}

const ErrorNotification: React.FC = () => {
    const [errors, setErrors] = useState<ErrorItem[]>([]);

    useEffect(() => {
        const handleError = (event: Event) => {
            const customEvent = event as CustomEvent<ApiErrorInfo>;
            const errorInfo = customEvent.detail;
            const id = Math.random().toString(36).substr(2, 9);

            setErrors((prev) => [...prev, { ...errorInfo, id }]);

            // Auto-hide after 5 seconds
            setTimeout(() => {
                setErrors((prev) => prev.filter((e) => e.id !== id));
            }, 5000);
        };

        window.addEventListener('api-error', handleError);
        return () => window.removeEventListener('api-error', handleError);
    }, []);

    const removeError = (id: string) => {
        setErrors((prev) => prev.filter((e) => e.id !== id));
    };

    if (errors.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {errors.map((error: ErrorItem) => (
                <div
                    key={error.id}
                    className="bg-red-50 border-l-4 border-red-500 p-4 shadow-lg rounded-r flex items-start gap-3 animate-slide-in"
                >
                    <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-800">
                            Error: {error.code}
                        </h3>
                        <div className="mt-1 text-sm text-red-700">
                            {error.message}
                        </div>
                        {error.details && (
                            <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto max-h-32">
                                <pre>{JSON.stringify(error.details, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => removeError(error.id)}
                        className="flex-shrink-0 text-red-400 hover:text-red-500"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ErrorNotification;
