document.addEventListener('DOMContentLoaded', () => {
    console.log('Bowler stats page loaded');
    
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
    const addBowlerStatsBtn = document.getElementById('add-bowler-stats-btn');
    const bowlerStatsModal = document.getElementById('bowler-stats-modal');
    const bowlerStatsForm = document.getElementById('bowler-stats-form');
    const bowlerStatsTbody = document.getElementById('bowler-stats-tbody');
    const summaryStats = document.getElementById('summary-stats');
    const pagination = document.getElementById('pagination');

    // Form elements
    const statsIdInput = document.getElementById('stats-id');
    const statsPlayerSelect = document.getElementById('stats-player');
    const statsMatchSelect = document.getElementById('stats-match');
    const statsInningsInput = document.getElementById('stats-innings');
    const statsBowlingTeamSelect = document.getElementById('stats-bowling-team');
    const statsBattingTeamSelect = document.getElementById('stats-batting-team');
    const statsWicketsInput = document.getElementById('stats-wickets');
    const statsRunsConcededInput = document.getElementById('stats-runs-conceded');
    const statsOversInput = document.getElementById('stats-overs');
    const statsMaidensInput = document.getElementById('stats-maidens');
    const statsWidesInput = document.getElementById('stats-wides');
    const statsNoBallsInput = document.getElementById('stats-no-balls');
    const statsByesInput = document.getElementById('stats-byes');
    const statsLegByesInput = document.getElementById('stats-leg-byes');
    const statsCatchesInput = document.getElementById('stats-catches');
    const statsStumpingsInput = document.getElementById('stats-stumpings');
    const statsRunOutsInput = document.getElementById('stats-run-outs');

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

    function formatOvers(overs) {
        if (!overs) return '0';
        const wholeOvers = Math.floor(overs);
        const balls = Math.round((overs - wholeOvers) * 10);
        return balls === 0 ? wholeOvers.toString() : `${wholeOvers}.${balls}`;
    }

    function parseOvers(oversString) {
        if (!oversString) return 0;
        const parts = oversString.split('.');
        const wholeOvers = parseInt(parts[0]) || 0;
        const balls = parseInt(parts[1]) || 0;
        return wholeOvers + (balls / 10);
    }

    function formatRate(rate) {
        return rate ? rate.toFixed(2) : '0.00';
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
                populateDropdown(statsBowlingTeamSelect, allTeams, null, true);
                populateDropdown(statsBattingTeamSelect, allTeams, null, true);

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

        const stats = await apiRequest(`/bowler-stats?${queryParams}`);
        if (stats) {
            currentStats = stats;
            renderStatsTable(stats);
            renderSummaryStats(stats);
            renderPagination();
        }
    }

    function renderStatsTable(stats) {
        bowlerStatsTbody.innerHTML = '';
        
        if (stats.length === 0) {
            const row = bowlerStatsTbody.insertRow();
            row.innerHTML = '<td colspan="18" style="text-align: center; padding: 20px;">No bowler statistics found</td>';
            return;
        }

        stats.forEach(stat => {
            const row = bowlerStatsTbody.insertRow();
            row.innerHTML = `
                <td>
                    <div class="player-name">${stat.player ? stat.player.name : 'N/A'}</div>
                    <div class="team-name">${stat.bowlingTeam ? stat.bowlingTeam.name : 'N/A'}</div>
                </td>
                <td>${stat.bowlingTeam ? stat.bowlingTeam.name : 'N/A'}</td>
                <td>
                    <div>${stat.match ? `${stat.match.team1 ? stat.match.team1.name : 'Unknown'} vs ${stat.match.team2 ? stat.match.team2.name : 'Unknown'}` : 'N/A'}</div>
                    <div style="font-size: 0.8em; color: #666;">${formatDate(stat.matchDate)}</div>
                </td>
                <td class="stats-value">${stat.innings}</td>
                <td class="stats-value">${stat.wickets}</td>
                <td class="stats-value">${stat.runsConceded}</td>
                <td class="stats-value">${formatOvers(stat.overs)}</td>
                <td class="stats-value">${stat.maidens}</td>
                <td class="stats-value economy-rate">${formatRate(stat.economyRate)}</td>
                <td class="stats-value bowling-average">${formatRate(stat.bowlingAverage)}</td>
                <td class="stats-value strike-rate">${formatRate(stat.strikeRate)}</td>
                <td class="stats-value">${stat.wides}</td>
                <td class="stats-value">${stat.noBalls}</td>
                <td class="stats-value">${stat.catches}</td>
                <td class="stats-value">${stat.stumpings}</td>
                <td class="stats-value">${stat.runOuts}</td>
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
            totalWickets: stats.reduce((sum, s) => sum + s.wickets, 0),
            totalRunsConceded: stats.reduce((sum, s) => sum + s.runsConceded, 0),
            totalOvers: stats.reduce((sum, s) => sum + s.overs, 0),
            totalMaidens: stats.reduce((sum, s) => sum + s.maidens, 0),
            totalWides: stats.reduce((sum, s) => sum + s.wides, 0),
            totalNoBalls: stats.reduce((sum, s) => sum + s.noBalls, 0),
            totalCatches: stats.reduce((sum, s) => sum + s.catches, 0),
            totalStumpings: stats.reduce((sum, s) => sum + s.stumpings, 0),
            totalRunOuts: stats.reduce((sum, s) => sum + s.runOuts, 0),
            averageEconomyRate: 0,
            averageBowlingAverage: 0,
            averageStrikeRate: 0
        };

        if (summary.totalOvers > 0) {
            summary.averageEconomyRate = summary.totalRunsConceded / summary.totalOvers;
        }
        if (summary.totalWickets > 0) {
            summary.averageBowlingAverage = summary.totalRunsConceded / summary.totalWickets;
            summary.averageStrikeRate = (summary.totalOvers * 6) / summary.totalWickets;
        }

        summaryStats.innerHTML = `
            <div class="summary-item">
                <div class="value">${summary.totalInnings}</div>
                <div class="label">Innings</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.totalWickets}</div>
                <div class="label">Total Wickets</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.totalRunsConceded}</div>
                <div class="label">Runs Conceded</div>
            </div>
            <div class="summary-item">
                <div class="value">${formatOvers(summary.totalOvers)}</div>
                <div class="label">Total Overs</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.totalMaidens}</div>
                <div class="label">Maidens</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.averageEconomyRate.toFixed(2)}</div>
                <div class="label">Avg Economy</div>
            </div>
            <div class="summary-item">
                <div class="value">${summary.averageBowlingAverage.toFixed(2)}</div>
                <div class="label">Avg Bowling Avg</div>
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
    if (addBowlerStatsBtn) {
        addBowlerStatsBtn.onclick = () => {
            editingStatsId = null;
            if (modalTitle) modalTitle.textContent = 'Add Bowler Statistics';
            if (bowlerStatsForm) bowlerStatsForm.reset();
            if (statsIdInput) statsIdInput.value = '';
            if (bowlerStatsModal) bowlerStatsModal.style.display = 'block';
        };
    }

    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            if (bowlerStatsModal) bowlerStatsModal.style.display = 'none';
        };
    }

    if (cancelStatsBtn) {
        cancelStatsBtn.onclick = () => {
            if (bowlerStatsModal) bowlerStatsModal.style.display = 'none';
        };
    }

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === bowlerStatsModal) {
            bowlerStatsModal.style.display = 'none';
        }
    };

    // Form submission
    if (bowlerStatsForm) {
        bowlerStatsForm.onsubmit = async (e) => {
            e.preventDefault();

            const formData = {
                player: statsPlayerSelect ? statsPlayerSelect.value : '',
                match: statsMatchSelect ? statsMatchSelect.value : '',
                innings: parseInt(statsInningsInput ? statsInningsInput.value : 0),
                bowlingTeam: statsBowlingTeamSelect ? statsBowlingTeamSelect.value : '',
                battingTeam: statsBattingTeamSelect ? statsBattingTeamSelect.value : '',
                wickets: parseInt(statsWicketsInput ? statsWicketsInput.value : 0) || 0,
                runsConceded: parseInt(statsRunsConcededInput ? statsRunsConcededInput.value : 0) || 0,
                overs: parseOvers(statsOversInput ? statsOversInput.value : 0),
                maidens: parseInt(statsMaidensInput ? statsMaidensInput.value : 0) || 0,
                wides: parseInt(statsWidesInput ? statsWidesInput.value : 0) || 0,
                noBalls: parseInt(statsNoBallsInput ? statsNoBallsInput.value : 0) || 0,
                byes: parseInt(statsByesInput ? statsByesInput.value : 0) || 0,
                legByes: parseInt(statsLegByesInput ? statsLegByesInput.value : 0) || 0,
                catches: parseInt(statsCatchesInput ? statsCatchesInput.value : 0) || 0,
                stumpings: parseInt(statsStumpingsInput ? statsStumpingsInput.value : 0) || 0,
                runOuts: parseInt(statsRunOutsInput ? statsRunOutsInput.value : 0) || 0,
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
                result = await apiRequest(`/bowler-stats/${editingStatsId}`, 'PUT', formData);
            } else {
                result = await apiRequest('/bowler-stats', 'POST', formData);
            }

            if (result) {
                if (bowlerStatsModal) bowlerStatsModal.style.display = 'none';
                await fetchAndRenderStats();
                alert(`Bowler statistics ${editingStatsId ? 'updated' : 'added'} successfully!`);
            }
        };
    }

    // Edit stats
    async function editStats(id) {
        const stats = await apiRequest(`/bowler-stats/${id}`);
        if (stats) {
            editingStatsId = stats._id;
            if (modalTitle) modalTitle.textContent = 'Edit Bowler Statistics';
            if (statsIdInput) statsIdInput.value = stats._id;

            if (statsPlayerSelect) statsPlayerSelect.value = stats.player ? stats.player._id : '';
            if (statsMatchSelect) statsMatchSelect.value = stats.match ? stats.match._id : '';
            if (statsInningsInput) statsInningsInput.value = stats.innings;
            if (statsBowlingTeamSelect) statsBowlingTeamSelect.value = stats.bowlingTeam ? stats.bowlingTeam._id : '';
            if (statsBattingTeamSelect) statsBattingTeamSelect.value = stats.battingTeam ? stats.battingTeam._id : '';
            if (statsWicketsInput) statsWicketsInput.value = stats.wickets;
            if (statsRunsConcededInput) statsRunsConcededInput.value = stats.runsConceded;
            if (statsOversInput) statsOversInput.value = formatOvers(stats.overs);
            if (statsMaidensInput) statsMaidensInput.value = stats.maidens;
            if (statsWidesInput) statsWidesInput.value = stats.wides;
            if (statsNoBallsInput) statsNoBallsInput.value = stats.noBalls;
            if (statsByesInput) statsByesInput.value = stats.byes;
            if (statsLegByesInput) statsLegByesInput.value = stats.legByes;
            if (statsCatchesInput) statsCatchesInput.value = stats.catches;
            if (statsStumpingsInput) statsStumpingsInput.value = stats.stumpings;
            if (statsRunOutsInput) statsRunOutsInput.value = stats.runOuts;

            if (bowlerStatsModal) bowlerStatsModal.style.display = 'block';
        }
    }

    // Delete stats
    async function deleteStats(id) {
        if (confirm('Are you sure you want to delete these bowling statistics?')) {
            const result = await apiRequest(`/bowler-stats/${id}`, 'DELETE');
            if (result) {
                await fetchAndRenderStats();
                alert('Bowler statistics deleted successfully!');
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

            const headers = ['Player', 'Team', 'Match', 'Innings', 'Wickets', 'Runs Conceded', 'Overs', 'Maidens', 'Economy Rate', 'Bowling Average', 'Strike Rate', 'Wides', 'No Balls', 'Catches', 'Stumpings', 'Run Outs', 'Date'];
            const csvContent = [
                headers.join(','),
                ...currentStats.map(stat => [
                    stat.player ? stat.player.name : 'N/A',
                    stat.bowlingTeam ? stat.bowlingTeam.name : 'N/A',
                    stat.match ? (stat.match.team1 ? stat.match.team1.name : 'Unknown') + ' vs ' + (stat.match.team2 ? stat.match.team2.name : 'Unknown') : 'N/A',
                    stat.innings,
                    stat.wickets,
                    stat.runsConceded,
                    formatOvers(stat.overs),
                    stat.maidens,
                    formatRate(stat.economyRate),
                    formatRate(stat.bowlingAverage),
                    formatRate(stat.strikeRate),
                    stat.wides,
                    stat.noBalls,
                    stat.catches,
                    stat.stumpings,
                    stat.runOuts,
                    formatDate(stat.matchDate)
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bowler-stats-' + new Date().toISOString().split('T')[0] + '.csv';
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
            a.download = 'bowler-stats-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            window.URL.revokeObjectURL(url);
        };
    }

    // --- Initialize ---
    loadInitialData();
    } catch (error) {
        console.error('Error in bowler-stats.js:', error);
        alert('An unexpected error occurred. Please refresh the page or contact support.');
    }
}); 