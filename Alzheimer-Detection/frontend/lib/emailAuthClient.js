// Email authentication client utility
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

class EmailAuthClient {
    constructor() {
        this.token = null;
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('auth_token');
        }
    }

    setToken(token) {
        this.token = token;
        if (typeof window !== 'undefined') {
            if (token) {
                localStorage.setItem('auth_token', token);
            } else {
                localStorage.removeItem('auth_token');
            }
        }
    }

    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    async register(userData) {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(userData),
        });

        const data = await response.json();
        
        if (response.ok) {
            this.setToken(data.token);
            return data;
        } else {
            throw new Error(data.error || 'Registration failed');
        }
    }

    async login(email, password) {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        
        if (response.ok) {
            this.setToken(data.token);
            return data;
        } else {
            throw new Error(data.error || 'Login failed');
        }
    }

    async verifyToken() {
        if (!this.token) {
            return null;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/verify-token`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
            });

            const data = await response.json();
            
            if (response.ok) {
                return data;
            } else {
                // Token is invalid, remove it
                this.setToken(null);
                return null;
            }
        } catch (error) {
            // Network error or other issues
            this.setToken(null);
            return null;
        }
    }

    async getProfile() {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            method: 'GET',
            headers: this.getAuthHeaders(),
        });

        const data = await response.json();
        
        if (response.ok) {
            return data.user;
        } else {
            throw new Error(data.error || 'Failed to get profile');
        }
    }

    async changePassword(currentPassword, newPassword) {
        const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
            }),
        });

        const data = await response.json();
        
        if (response.ok) {
            return data;
        } else {
            throw new Error(data.error || 'Password change failed');
        }
    }

    async forgotPassword(email) {
        const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ email }),
        });

        const data = await response.json();
        
        if (response.ok) {
            return data;
        } else {
            throw new Error(data.error || 'Password reset request failed');
        }
    }

    async resetPassword(token, newPassword) {
        const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                token,
                new_password: newPassword,
            }),
        });

        const data = await response.json();
        
        if (response.ok) {
            return data;
        } else {
            throw new Error(data.error || 'Password reset failed');
        }
    }

    async verifyEmail(token) {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ token }),
        });

        const data = await response.json();
        
        if (response.ok) {
            return data;
        } else {
            throw new Error(data.error || 'Email verification failed');
        }
    }

    logout() {
        this.setToken(null);
    }

    isAuthenticated() {
        return !!this.token;
    }
}

// Create singleton instance
const emailAuthClient = new EmailAuthClient();

export default emailAuthClient;