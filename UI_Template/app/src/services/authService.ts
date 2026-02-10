/**
 * Authentication service
 */

import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    full_name?: string;
}

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export interface User {
    id: string;
    email: string;
    full_name?: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

export const authService = {
    /**
     * Register a new user
     */
    async register(data: RegisterData): Promise<User> {
        const response = await apiClient.post<User>(API_CONFIG.ENDPOINTS.AUTH.REGISTER, data);
        return response.data;
    },

    /**
     * Login user and get tokens
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await apiClient.post<AuthResponse>(
            API_CONFIG.ENDPOINTS.AUTH.LOGIN,
            credentials
        );

        const { access_token, refresh_token } = response.data;

        // Store tokens
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        return response.data;
    },

    /**
     * Get current user info
     */
    async getCurrentUser(): Promise<User> {
        const response = await apiClient.get<User>(API_CONFIG.ENDPOINTS.AUTH.ME);

        // Store user data
        localStorage.setItem('user', JSON.stringify(response.data));

        return response.data;
    },

    /**
     * Logout user
     */
    async logout(): Promise<void> {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return !!localStorage.getItem('access_token');
    },

    /**
     * Get stored user data
     */
    getStoredUser(): User | null {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;

        try {
            return JSON.parse(userStr);
        } catch {
            return null;
        }
    },
};
