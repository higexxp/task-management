// Simple logger for frontend
export const logger = {
    debug: (message: string, data?: any) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${message}`, data || '');
        }
    },

    info: (message: string, data?: any) => {
        if (process.env.NODE_ENV === 'development') {
            console.info(`[INFO] ${message}`, data || '');
        }
    },

    warn: (message: string, data?: any) => {
        console.warn(`[WARN] ${message}`, data || '');
    },

    error: (message: string, data?: any) => {
        console.error(`[ERROR] ${message}`, data || '');
    },
};