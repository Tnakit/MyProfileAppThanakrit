// Central place for the backend URL.
// Change it here once instead of in every screen.
export const API_BASE_URL = 'http://119.59.102.161:3107';

export const api = (path: string) => `${API_BASE_URL}${path}`;