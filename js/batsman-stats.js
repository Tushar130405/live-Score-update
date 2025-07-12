document.addEventListener('DOMContentLoaded', () => {
    console.log('Batsman stats page loaded');
    
    try {
        const API_BASE_URL = 'http://localhost:3000/api';

        const token = localStorage.getItem('adminAuthToken');
        if (!token) {
            console.log('No auth token found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        console.log('Auth token found, proceeding with initialization');

    // --- DOM Elements ---
    const addBatsmanStatsBtn = document.getElementById('add-batsman-stats-btn');
    const batsmanStatsModal = document.getElementById('batsman-stats-modal');
    const batsmanStatsForm = document.getElementById('batsman-stats-form');
    const batsmanStatsTbody = document.getElementById('batsman-stats-tbody');
    const summaryStats = document.getElementById('summary-stats');
    const pagination = document.getElementById('pagination');

    // Form elements
    const statsIdInput = document.getElementById('stats-id');
    const statsPlayerSelect = document.getElementById('stats-player');
    const statsMatchSelect = document.getElementById('stats-match');
    const statsInningsInput = document.getElementById('stats-innings');
    const statsBattingTeamSelect = document.getElementById('stats-batting-team');
    const statsBowlingTeamSelect = document.getElementById('stats-bowling-team');
    const statsRunsInput = document.getElementById('stats-runs');
    const statsBallsInput = document.getElementById('stats-balls');
    const statsFoursInput = document.getElementById('stats-fours');
    const statsSixesInput = document.getElementById('stats-sixes');
    const statsNotOutCheckbox = document.getElementById('stats-not-out');
    const statsDismissalTypeSelect = document.getElementById('stats-dismissal-type');
    const statsBowlerDismissalSelect = document.getElementById('stats-bowler-dismissal');
    const statsFielderDismissalSelect = document.getElementById('stats-fielder-dismissal');

    // Filter elements
    const playerFilter = document.getElementById('player-filter');
    const teamFilter = document.getElementById('team-filter');
    const formatFilter = document.getElementById('format-filter');
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // Export buttons
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');

    // Modal elements
    const modalTitle = document.getElementById('modal-title');
    const closeModalBtn = document.querySelector('.close');
    const cancelStatsBtn = document.getElementById('cancel-stats-btn');

    let editingStatsId = null;
    let allPlayers = [];
    let allTeams = [];
    let allMatches = [];
    let currentStats = [];
    let currentPage = 1;
    const itemsPerPage = 20;

    // --- API Helper ---
    async function apiRequest(endpoint, method = 'GET', data = null) {
        console.log(`Making API request: ${method} ${endpoint}`);
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        const config = { method, headers };
        if (data) config.body = JSON.stringify(data);

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            console.log(`Response status: ${response.status}`);
            
            if (response.status === 401 || response.status === 403) {
                console.log('Authentication failed, redirecting to login');
                alert('Session expired or unauthorized. Please log in again.');
                window.logout();
                return null;
            }
            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = response.status === 204 || method === 'DELETE' ? {} : await response.json();
            console.log(`API request successful: ${method} ${endpoint}`);
            return result;
        } catch (error) {
            console.error(`API Request Error (${method} ${endpoint}):`, error);
            alert(`Operation failed: ${error.message}`);
            return null;
        }
    }

    // --- Utility Functions ---
    function populateDropdown(selectElement, dataArray, selectedId = null, includeNoneOption = false) {
        selectElement.innerHTML = '';
        if (includeNoneOption) {
            const noneOption = document.createElement('option');
            noneOption.value = '';
            noneOption.textContent = 'Select...';
            selectElement.appendChild(noneOption);
        }
        dataArray.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id;
            option.textContent = item.name;
            if (item._id === selectedId) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    function formatStrikeRate(strikeRate) {
        return strikeRate ? strikeRate.toFixed(2) : '0.00';
    }

    function getDismissalClass(dismissalType) {
        if (!dismissalType) return '';
        return `dismissal-${dismissalType.replace(' ', '-')}`;
    }

    // --- Load Data ---
    async function loadInitialData() {
        try {
            allPlayers = await apiRequest('/players');
            allTeams = await apiRequest('/teams');
            allMatches = await apiRequest('/matches');

            if (allPlayers && allTeams && allMatches) {
                populateDropdown(playerFilter, allPlayers, null, true);
                populateDropdown(teamFilter, allTeams, null, true);
                populateDropdown(statsPlayerSelect, allPlayers, null, true);
                populateDropdown(statsBattingTeamSelect, allTeams, null, true);
                populateDropdown(statsBowlingTeamSelect, allTeams, null, true);
                populateDropdown(statsBowlerDismissalSelect, allPlayers, null, true);
                populateDropdown(statsFielderDismissalSelect, allPlayers, null, true);

                // Populate match dropdown with formatted names
                if (statsMatchSelect) {
                    statsMatchSelect.innerHTML = '<option value="">Select Match</option>';
                    allMatches.forEach(match => {
                        const option = document.createElement('option');
                        option.value = match._id;
                        const team1Name = match.team1 ? match.team1.name : 'Unknown';
                        const team2Name = match.team2 ? match.team2.name : 'Unknown';
                        const matchDate = formatDate(match.matchDate);
                        option.textContent = team1Name + ' vs ' + team2Name + ' (' + matchDate + ')';
                        statsMatchSelect.appendChild(option);
                    });
                }

                await fetchAndRenderStats();
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
            alert('Error loading data. Please refresh the page.');
        }
    }

    // --- Fetch and Render Stats ---
    async function fetchAndRenderStats() {
        const queryParams = new URLSearchParams();
        
        if (playerFilter && playerFilter.value) queryParams.append('player', playerFilter.value);
        if (teamFilter && teamFilter.value) queryParams.append('team', teamFilter.value);
        if (formatFilter && formatFilter.value) queryParams.append('format', formatFilter.value);
        if (dateFromInput && dateFromInput.value) queryParams.append('dateFrom', dateFromInput.value);
        if (dateToInput && dateToInput.value) queryParams.append('dateTo', dateToInput.value);
        
        queryParams.append('limit', itemsPerPage);
        queryParams.append('skip', (currentPage - 1) * itemsPerPage);

        const stats = await apiRequest(`/batsman-stats?${queryParams}`);
        if (stats) {
            currentStats = stats;
            renderStatsTable(stats);
            renderSummaryStats(stats);
            renderPagination();
        }
    }

    function renderStatsTable(stats) {
        batsmanStatsTbody.innerHTML = '';
        
        if (stats.length === 0) {
            const row = batsmanStatsTbody.insertRow();
            row.innerHTML = '<td colspan="14" style="text-align: center; padding: 20px;">No batsman statistics found</td>';
            return;
        }

        stats.forEach(stat => {
            const row = batsmanStatsTbody.insertRow();
            row.innerHTML = `
                <td>
                    <div class="player-name">${stat.player ? stat.player.name : 'N/A'}</div>
                    <div class="team-name">${stat.battingTeam ? stat.battingTeam.name : 'N/A'}</div>
                </td>
                <td>${stat.battingTeam ? stat.battingTeam.name : 'N/A'}</td>
                <td>
                    <div>${stat.match ? `${stat.match.team1 ? stat.match.team1.name : 'Unknown'} vs ${stat.match.team2 ? stat.match.team2.name : 'Unknown'}` : 'N/A'}</div>
                    <div style="font-size: 0.8em; color: #666;">${formatDate(stat.matchDate)}</div>
                </td>
                <td class="stats-value">${stat.innings}</td>
                <td class="stats-value">${stat.runs}</td>
                <td class="stats-value">${stat.balls}</td>
                <td class="stats-value">${stat.fours}</td>
                <td class="stats-value">${stat.sixes}</td>
                <td class="stats-value strike-rate">${formatStrikeRate(stat.strikeRate)}</td>
                <td>
                    <span class="dismissal-type ${getDismissalClass(stat.dismissalType)}">
                        ${stat.isNotOut ? 'Not Out' : (stat.dismissalType || 'N/A')}
                    </span>
                </td>
                <td>${stat.bowlerDismissal ? stat.bowlerDismissal.name : 'N/A'}</td>
                <td>${stat.fielderDismissal ? stat.fielderDismissal.name : 'N/A'}</td>
                <td>${formatDate(stat.matchDate)}</td>
                <td class="action-buttons">
                    <button class="btn btn-secondary btn-sm edit-stats-btn" data-id="${stat._id}">Edit</button>
                    <button class="btn btn-danger btn-sm delete-stats-btn" data-id="${stat._id}">Delete</button>
                </td>
            `;
        });

        attachTableEventListeners();
    }

    function renderSummaryStats(stats) {
        if (stats.length === 0) {
            summaryStats.innerHTML = '<p>No statistics available</p>';
            return;
        }

        const summary = {
            totalInnings: stats.length,
            totalRuns: stats.reduce((sum, s) => sum + s.runs, 0),
            totalBalls: stats.reduce((sum, s) => sum + s.balls, 0),
            totalFours: stats.reduce((sum, s) => sum + s.fours, 0),
            totalSixes: stats.reduce((sum, s) => sum + s.sixes, 0),
            notOuts: stats.filter(s => s.isNotOut).length,
            dismissals: stats.filter(s => !s.isNotOut).length,
            averageStrikeRate: 0
        };

        if (summary.totalBalls > 0) {
            summary.averageStrikeRate = (summary.totalRuns / summary.totalBalls) * 100;
        }

        summaryStats.innerHTML = `
            <div class="summary-item">
                <div class="value">${summary.totalInnings}</div>
                <div class="label">Innings</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.totalRuns}</div>
                <div class="label">Total Runs</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.totalBalls}</div>
                <div class="label">Total Balls</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.totalFours}</div>
                <div class="label">Fours</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.totalSixes}</div>
                <div class="label">Sixes</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.notOuts}</div>
                <div class="label">Not Outs</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.averageStrikeRate.toFixed(2)}</div>
                <div class="label">Avg Strike Rate</div>
            </div>
        `;
    }

    function renderPagination() {
        // Simple pagination - in a real app, you'd get total count from API
        pagination.innerHTML = `
            <button onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>Previous</button>
            <span>Page ${currentPage}</span>
            <button onclick="changePage(${currentPage + 1})" ${currentStats.length < itemsPerPage ? 'disabled' : ''}>Next</button>
        `;
    }

    // Make changePage function global
    window.changePage = function(newPage) {
        if (newPage >= 1) {
            currentPage = newPage;
            fetchAndRenderStats();
        }
    };

    // --- Event Listeners ---
    function attachTableEventListeners() {
        const editButtons = document.querySelectorAll('.edit-stats-btn');
        const deleteButtons = document.querySelectorAll('.delete-stats-btn');
        
        editButtons.forEach(button => {
            button.onclick = (e) => editStats(e.target.dataset.id);
        });
        deleteButtons.forEach(button => {
            button.onclick = (e) => deleteStats(e.target.dataset.id);
        });
    }

    // Modal controls
    if (addBatsmanStatsBtn) {
        addBatsmanStatsBtn.onclick = () => {
            editingStatsId = null;
            if (modalTitle) modalTitle.textContent = 'Add Batsman Statistics';
            if (batsmanStatsForm) batsmanStatsForm.reset();
            if (statsIdInput) statsIdInput.value = '';
            if (batsmanStatsModal) batsmanStatsModal.style.display = 'block';
        };
    }

    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            if (batsmanStatsModal) batsmanStatsModal.style.display = 'none';
        };
    }

    if (cancelStatsBtn) {
        cancelStatsBtn.onclick = () => {
            if (batsmanStatsModal) batsmanStatsModal.style.display = 'none';
        };
    }

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === batsmanStatsModal) {
            batsmanStatsModal.style.display = 'none';
        }
    };

    // Form submission
    if (batsmanStatsForm) {
        batsmanStatsForm.onsubmit = async (e) => {
            e.preventDefault();

            const formData = {
                player: statsPlayerSelect ? statsPlayerSelect.value : '',
                match: statsMatchSelect ? statsMatchSelect.value : '',
                innings: parseInt(statsInningsInput ? statsInningsInput.value : 0),
                battingTeam: statsBattingTeamSelect ? statsBattingTeamSelect.value : '',
                bowlingTeam: statsBowlingTeamSelect ? statsBowlingTeamSelect.value : '',
                runs: parseInt(statsRunsInput ? statsRunsInput.value : 0) || 0,
                balls: parseInt(statsBallsInput ? statsBallsInput.value : 0) || 0,
                fours: parseInt(statsFoursInput ? statsFoursInput.value : 0) || 0,
                sixes: parseInt(statsSixesInput ? statsSixesInput.value : 0) || 0,
                isNotOut: statsNotOutCheckbox ? statsNotOutCheckbox.checked : false,
                dismissalType: statsDismissalTypeSelect ? statsDismissalTypeSelect.value : undefined,
                bowlerDismissal: statsBowlerDismissalSelect ? statsBowlerDismissalSelect.value : undefined,
                fielderDismissal: statsFielderDismissalSelect ? statsFielderDismissalSelect.value : undefined,
                matchDate: (() => {
                    const match = allMatches.find(m => m._id === (statsMatchSelect ? statsMatchSelect.value : ''));
                    return match ? match.matchDate : undefined;
                })(),
                venue: (() => {
                    const match = allMatches.find(m => m._id === (statsMatchSelect ? statsMatchSelect.value : ''));
                    return match ? match.venue : undefined;
                })(),
                format: (() => {
                    const match = allMatches.find(m => m._id === (statsMatchSelect ? statsMatchSelect.value : ''));
                    return match ? match.format : undefined;
                })()
            };

            let result = null;
            if (editingStatsId) {
                result = await apiRequest(`/batsman-stats/${editingStatsId}`, 'PUT', formData);
            } else {
                result = await apiRequest('/batsman-stats', 'POST', formData);
            }

            if (result) {
                if (batsmanStatsModal) batsmanStatsModal.style.display = 'none';
                await fetchAndRenderStats();
                alert(`Batsman statistics ${editingStatsId ? 'updated' : 'added'} successfully!`);
            }
        };
    }

    // Edit stats
    async function editStats(id) {
        const stats = await apiRequest(`/batsman-stats/${id}`);
        if (stats) {
            editingStatsId = stats._id;
            if (modalTitle) modalTitle.textContent = 'Edit Batsman Statistics';
            if (statsIdInput) statsIdInput.value = stats._id;

            if (statsPlayerSelect) statsPlayerSelect.value = stats.player ? stats.player._id : '';
            if (statsMatchSelect) statsMatchSelect.value = stats.match ? stats.match._id : '';
            if (statsInningsInput) statsInningsInput.value = stats.innings;
            if (statsBattingTeamSelect) statsBattingTeamSelect.value = stats.battingTeam ? stats.battingTeam._id : '';
            if (statsBowlingTeamSelect) statsBowlingTeamSelect.value = stats.bowlingTeam ? stats.bowlingTeam._id : '';
            if (statsRunsInput) statsRunsInput.value = stats.runs;
            if (statsBallsInput) statsBallsInput.value = stats.balls;
            if (statsFoursInput) statsFoursInput.value = stats.fours;
            if (statsSixesInput) statsSixesInput.value = stats.sixes;
            if (statsNotOutCheckbox) statsNotOutCheckbox.checked = stats.isNotOut;
            if (statsDismissalTypeSelect) statsDismissalTypeSelect.value = stats.dismissalType || '';
            if (statsBowlerDismissalSelect) statsBowlerDismissalSelect.value = stats.bowlerDismissal ? stats.bowlerDismissal._id : '';
            if (statsFielderDismissalSelect) statsFielderDismissalSelect.value = stats.fielderDismissal ? stats.fielderDismissal._id : '';

            if (batsmanStatsModal) batsmanStatsModal.style.display = 'block';
        }
    }

    // Delete stats
    async function deleteStats(id) {
        if (confirm('Are you sure you want to delete these batting statistics?')) {
            const result = await apiRequest(`/batsman-stats/${id}`, 'DELETE');
            if (result) {
                await fetchAndRenderStats();
                alert('Batsman statistics deleted successfully!');
            }
        }
    }

    // Filter controls
    if (applyFiltersBtn) {
        applyFiltersBtn.onclick = () => {
            currentPage = 1;
            fetchAndRenderStats();
        };
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.onclick = () => {
            if (playerFilter) playerFilter.value = '';
            if (teamFilter) teamFilter.value = '';
            if (formatFilter) formatFilter.value = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            currentPage = 1;
            fetchAndRenderStats();
        };
    }

    // Export functionality
    if (exportCsvBtn) {
        exportCsvBtn.onclick = () => {
            if (currentStats.length === 0) {
                alert('No data to export');
                return;
            }

            const headers = ['Player', 'Team', 'Match', 'Innings', 'Runs', 'Balls', '4s', '6s', 'Strike Rate', 'Dismissal', 'Bowler', 'Fielder', 'Date'];
            const csvContent = [
                headers.join(','),
                ...currentStats.map(stat => [
                    stat.player ? stat.player.name : 'N/A',
                    stat.battingTeam ? stat.battingTeam.name : 'N/A',
                    stat.match ? (stat.match.team1 ? stat.match.team1.name : 'Unknown') + ' vs ' + (stat.match.team2 ? stat.match.team2.name : 'Unknown') : 'N/A',
                    stat.innings,
                    stat.runs,
                    stat.balls,
                    stat.fours,
                    stat.sixes,
                    formatStrikeRate(stat.strikeRate),
                    stat.isNotOut ? 'Not Out' : (stat.dismissalType || 'N/A'),
                    stat.bowlerDismissal ? stat.bowlerDismissal.name : 'N/A',
                    stat.fielderDismissal ? stat.fielderDismissal.name : 'N/A',
                    formatDate(stat.matchDate)
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'batsman-stats-' + new Date().toISOString().split('T')[0] + '.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        };
    }

    if (exportJsonBtn) {
        exportJsonBtn.onclick = () => {
            if (currentStats.length === 0) {
                alert('No data to export');
                return;
            }

            const jsonContent = JSON.stringify(currentStats, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'batsman-stats-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            window.URL.revokeObjectURL(url);
        };
    }

    // --- Initialize ---
    loadInitialData();
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
        alert('An unexpected error occurred. Please refresh the page.');
    }
}); 