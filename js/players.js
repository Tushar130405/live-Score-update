document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api'; // Your backend API URL

    // --- Authentication Check ---
    const token = localStorage.getItem('adminAuthToken');
    if (!token) {
        window.location.href = 'login.html'; // Redirect to login if no token
        return;
    }

    // --- DOM Elements ---
    const addPlayerBtn = document.getElementById('add-player-btn');
    const playerFormContainer = document.getElementById('player-form-container');
    const playerForm = document.getElementById('player-form');
    const playersTableBody = document.querySelector('#players-table tbody');
    const cancelPlayerFormBtn = document.getElementById('cancel-player-form');
    const playerIdInput = document.getElementById('player-id'); // Hidden input for ID

    // Form fields
    const playerNameInput = document.getElementById('player-name');
    const playerCountryInput = document.getElementById('player-country');
    const playerRoleSelect = document.getElementById('player-role');

    let editingPlayerId = null; // To track which player is being edited (MongoDB _id)

    // --- API Helper Function with Auth ---
    async function apiRequest(endpoint, method = 'GET', data = null) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const config = {
            method,
            headers
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

            if (response.status === 401 || response.status === 403) {
                alert('Session expired or unauthorized. Please log in again.');
                window.logout(); // Use the global logout function
                return null; // Important: prevent further execution if unauthorized
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            // For DELETE requests, response might be empty
            return response.status === 204 || method === 'DELETE' ? {} : await response.json();
        } catch (error) {
            console.error(`API Request Error (${method} ${endpoint}):`, error);
            alert(`Operation failed: ${error.message}`);
            return null;
        }
    }

    // --- Render Players Table ---
    async function fetchAndRenderPlayers() {
        const players = await apiRequest('/players');
        if (players) { // Check if API call was successful
            playersTableBody.innerHTML = ''; // Clear existing rows
            players.forEach(player => {
                const row = playersTableBody.insertRow();
                row.innerHTML = `
                    <td>${player._id}</td>
                    <td>${player.name}</td>
                    <td>${player.country}</td>
                    <td>${player.role}</td>
                    <td class="action-buttons">
                        <button class="btn btn-secondary btn-sm edit-player-btn" data-id="${player._id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-player-btn" data-id="${player._id}">Delete</button>
                    </td>
                `;
            });
            attachEventListeners();
        }
    }

    // --- Attach Event Listeners for Edit/Delete Buttons ---
    function attachEventListeners() {
        document.querySelectorAll('.edit-player-btn').forEach(button => {
            button.onclick = (e) => editPlayer(e.target.dataset.id);
        });
        document.querySelectorAll('.delete-player-btn').forEach(button => {
            button.onclick = (e) => deletePlayer(e.target.dataset.id);
        });
    }

    // --- Form Visibility and Reset ---
    addPlayerBtn.onclick = () => {
        playerFormContainer.style.display = 'block';
        playerForm.reset();
        editingPlayerId = null;
        playerIdInput.value = ''; // Ensure hidden ID is clear
    };

    cancelPlayerFormBtn.onclick = () => {
        playerFormContainer.style.display = 'none';
    };

    // --- Handle Form Submission (Add/Edit Player) ---
    playerForm.onsubmit = async (e) => {
        e.preventDefault();

        const playerData = {
            name: playerNameInput.value,
            country: playerCountryInput.value,
            role: playerRoleSelect.value
        };

        let result = null;
        if (editingPlayerId) {
            // Update existing player
            result = await apiRequest(`/players/${editingPlayerId}`, 'PUT', playerData);
        } else {
            // Add new player
            result = await apiRequest('/players', 'POST', playerData);
        }

        if (result) {
            playerFormContainer.style.display = 'none'; // Hide form on success
            await fetchAndRenderPlayers(); // Refresh the table
        }
    };

    // --- Edit Player ---
    async function editPlayer(id) {
        const player = await apiRequest(`/players/${id}`);
        if (player) {
            playerNameInput.value = player.name;
            playerCountryInput.value = player.country;
            playerRoleSelect.value = player.role;
            playerIdInput.value = player._id;
            editingPlayerId = player._id;
            playerFormContainer.style.display = 'block';
        }
    }

    // --- Delete Player ---
    async function deletePlayer(id) {
        if (confirm('Are you sure you want to delete this player?')) {
            const result = await apiRequest(`/players/${id}`, 'DELETE');
            if (result) {
                await fetchAndRenderPlayers(); // Refresh the table
            }
        }
    }

    // --- Initial Load ---
    fetchAndRenderPlayers();
});