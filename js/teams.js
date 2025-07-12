document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api'; // Make sure this matches your backend URL

    // --- Authentication Check ---
    const token = localStorage.getItem('adminAuthToken');
    if (!token) {
        window.location.href = 'login.html'; // Redirect to login if no token
        return;
    }

    // --- DOM Elements ---
    const addTeamBtn = document.getElementById('add-team-btn');
    const teamFormContainer = document.getElementById('team-form-container');
    const teamForm = document.getElementById('team-form');
    const teamsTableBody = document.querySelector('#teams-table tbody');
    const cancelTeamFormBtn = document.getElementById('cancel-team-form');
    const teamIdInput = document.getElementById('team-id'); // Hidden input for ID

    // Form fields
    const teamNameInput = document.getElementById('team-name');
    const teamCountryInput = document.getElementById('team-country');
    const teamLogoUrlInput = document.getElementById('team-logo-url');

    let editingTeamId = null; // To track which team is being edited (MongoDB _id)

    // --- API Helper Function with Auth ---
    // (This is a duplicate of the one in players.js. For a larger app, you'd put this
    // in a shared utility file like `js/api.js` and import it.)
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
                return null;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return response.status === 204 || method === 'DELETE' ? {} : await response.json();
        } catch (error) {
            console.error(`API Request Error (${method} ${endpoint}):`, error);
            alert(`Operation failed: ${error.message}`);
            return null;
        }
    }

    // --- Render Teams Table ---
    async function fetchAndRenderTeams() {
        const teams = await apiRequest('/teams');
        if (teams) {
            teamsTableBody.innerHTML = ''; // Clear existing rows
            teams.forEach(team => {
                const row = teamsTableBody.insertRow();
                row.innerHTML = `
                    <td>${team._id}</td>
                    <td>${team.name}</td>
                    <td>${team.country}</td>
                    <td>${team.logoUrl ? `<img src="${team.logoUrl}" alt="${team.name} Logo" style="width: 50px; height: auto;">` : 'N/A'}</td>
                    <td class="action-buttons">
                        <button class="btn btn-secondary btn-sm edit-team-btn" data-id="${team._id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-team-btn" data-id="${team._id}">Delete</button>
                    </td>
                `;
            });
            attachEventListeners();
        }
    }

    // --- Attach Event Listeners for Edit/Delete Buttons ---
    function attachEventListeners() {
        document.querySelectorAll('.edit-team-btn').forEach(button => {
            button.onclick = (e) => editTeam(e.target.dataset.id);
        });
        document.querySelectorAll('.delete-team-btn').forEach(button => {
            button.onclick = (e) => deleteTeam(e.target.dataset.id);
        });
    }

    // --- Form Visibility and Reset ---
    addTeamBtn.onclick = () => {
        teamFormContainer.style.display = 'block';
        teamForm.reset();
        editingTeamId = null;
        teamIdInput.value = ''; // Ensure hidden ID is clear
    };

    cancelTeamFormBtn.onclick = () => {
        teamFormContainer.style.display = 'none';
    };

    // --- Handle Form Submission (Add/Edit Team) ---
    teamForm.onsubmit = async (e) => {
        e.preventDefault();

        const teamData = {
            name: teamNameInput.value,
            country: teamCountryInput.value,
            logoUrl: teamLogoUrlInput.value
        };

        let result = null;
        if (editingTeamId) {
            // Update existing team
            result = await apiRequest(`/teams/${editingTeamId}`, 'PUT', teamData);
        } else {
            // Add new team
            result = await apiRequest('/teams', 'POST', teamData);
        }

        if (result) {
            teamFormContainer.style.display = 'none'; // Hide form on success
            await fetchAndRenderTeams(); // Refresh the table
        }
    };

    // --- Edit Team ---
    async function editTeam(id) {
        const team = await apiRequest(`/teams/${id}`);
        if (team) {
            teamNameInput.value = team.name;
            teamCountryInput.value = team.country;
            teamLogoUrlInput.value = team.logoUrl || ''; // Handle null/undefined logoUrl
            teamIdInput.value = team._id;
            editingTeamId = team._id;
            teamFormContainer.style.display = 'block';
        }
    }

    // --- Delete Team ---
    async function deleteTeam(id) {
        if (confirm('Are you sure you want to delete this team?')) {
            const result = await apiRequest(`/teams/${id}`, 'DELETE');
            if (result) {
                await fetchAndRenderTeams(); // Refresh the table
            }
        }
    }

    // --- Initial Load ---
    fetchAndRenderTeams();
});