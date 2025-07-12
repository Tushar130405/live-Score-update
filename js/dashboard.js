document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api';

    const token = localStorage.getItem('adminAuthToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- API Helper ---
    async function apiRequest(endpoint, method = 'GET', data = null) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        const config = { method, headers };
        if (data) config.body = JSON.stringify(data);

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            if (response.status === 401 || response.status === 403) {
                alert('Session expired or unauthorized. Please log in again.');
                window.logout();
                return null;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return response.status === 204 || method === 'DELETE' ? {} : await response.json();
        } catch (error) {
            console.error(`API Request Error (${method} ${endpoint}):`, error);
            return null;
        }
    }

    // --- Load Dashboard Statistics ---
    async function loadDashboardStats() {
        try {
            // Load all statistics in parallel
            const [players, teams, matches, batsmanStats, bowlerStats] = await Promise.all([
                apiRequest('/players'),
                apiRequest('/teams'),
                apiRequest('/matches'),
                apiRequest('/batsman-stats'),
                apiRequest('/bowler-stats')
            ]);

            // Update the dashboard with counts
            document.getElementById('total-players').textContent = players ? players.length : 0;
            document.getElementById('total-teams').textContent = teams ? teams.length : 0;
            document.getElementById('total-matches').textContent = matches ? matches.length : 0;
            document.getElementById('total-batsman-stats').textContent = batsmanStats ? batsmanStats.length : 0;
            document.getElementById('total-bowler-stats').textContent = bowlerStats ? bowlerStats.length : 0;

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            // Set error values
            document.getElementById('total-players').textContent = 'Error';
            document.getElementById('total-teams').textContent = 'Error';
            document.getElementById('total-matches').textContent = 'Error';
            document.getElementById('total-batsman-stats').textContent = 'Error';
            document.getElementById('total-bowler-stats').textContent = 'Error';
        }
    }

    // --- Initialize Dashboard ---
    loadDashboardStats();
}); 