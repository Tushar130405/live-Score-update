document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');
    const API_BASE_URL = 'http://localhost:3000/api'; // Make sure this matches your backend URL

    // Check if already logged in (has token)
    const existingToken = localStorage.getItem('adminAuthToken');
    if (existingToken) {
        // In a real app, you'd want to validate this token with a backend endpoint
        // For simplicity, we'll just redirect if token exists
        window.location.href = 'dashboard.html';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = loginForm.username.value;
        const password = loginForm.password.value;

        loginMessage.textContent = ''; // Clear previous messages

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('adminAuthToken', data.token);
                window.location.href = 'dashboard.html'; // Redirect to dashboard
            } else {
                const errorData = await response.json();
                loginMessage.textContent = errorData.message || 'Login failed. Please check your credentials.';
            }
        } catch (error) {
            console.error('Login request failed:', error);
            loginMessage.textContent = 'Network error. Please try again.';
        }
    });

    // Logout Function (can be called from dashboard.html or other admin pages)
    // You might export this or make it globally available if using vanilla JS widely
    window.logout = function() {
        localStorage.removeItem('adminAuthToken');
        window.location.href = 'login.html';
    };
});