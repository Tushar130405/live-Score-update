document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api';

    const token = localStorage.getItem('adminAuthToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- DOM Elements ---
    const addMatchBtn = document.getElementById('add-match-btn');
    const matchFormContainer = document.getElementById('match-form-container');
    const matchForm = document.getElementById('match-form');
    const matchesTableBody = document.querySelector('#matches-table tbody');
    const cancelMatchFormBtn = document.getElementById('cancel-match-form');
    const matchIdInput = document.getElementById('match-id');

    // Form fields for main match details
    const matchDateInput = document.getElementById('match-date');
    const matchVenueInput = document.getElementById('match-venue');
    const matchFormatSelect = document.getElementById('match-format');
    const team1Select = document.getElementById('team1');
    const team2Select = document.getElementById('team2');
    const winnerSelect = document.getElementById('winner');
    const manOfTheMatchSelect = document.getElementById('man-of-the-match');
    const tossWinnerSelect = document.getElementById('toss-winner');
    const tossDecisionSelect = document.getElementById('toss-decision');
    const matchNotesInput = document.getElementById('match-notes');

    const inningsSection = document.getElementById('innings-section');
    const addInningsBtn = document.getElementById('add-innings-btn');
    const inningsListDiv = document.getElementById('innings-list');

    let editingMatchId = null;
    let allPlayers = []; // Cache players for dropdowns
    let allTeams = [];   // Cache teams for dropdowns

    // --- API Helper (Same as in players.js/teams.js, could be refactored to a shared file) ---
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
            alert(`Operation failed: ${error.message}`);
            return null;
        }
    }

    // --- Utility Functions ---

    // Populates a <select> element with options from an array of objects
    // dataArray: [ { _id: '...', name: '...' } ]
    // selectElement: The DOM select element
    // selectedId: The _id of the option that should be pre-selected
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

    function formatDateForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0]; // Formats to YYYY-MM-DD
    }

    // --- Render Matches Table ---
    async function fetchAndRenderMatches() {
        const matches = await apiRequest('/matches');
        if (matches) {
            matchesTableBody.innerHTML = '';
            matches.forEach(match => {
                const row = matchesTableBody.insertRow();
                const matchName = `${match.team1 ? match.team1.name : 'Unknown'} vs ${match.team2 ? match.team2.name : 'Unknown'}`;
                row.innerHTML = `
                    <td>${formatDateForInput(match.matchDate)}</td>
                    <td>${matchName}</td>
                    <td>${match.venue}</td>
                    <td>${match.format}</td>
                    <td>${match.winner ? match.winner.name : 'N/A'}</td>
                    <td>${match.manOfTheMatch ? match.manOfTheMatch.name : 'N/A'}</td>
                    <td class="action-buttons">
                        <button class="btn btn-secondary btn-sm edit-match-btn" data-id="${match._id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-match-btn" data-id="${match._id}">Delete</button>
                    </td>
                `;
            });
            attachEventListeners();
        }
    }

    // --- Attach Event Listeners for Edit/Delete Buttons ---
    function attachEventListeners() {
        document.querySelectorAll('.edit-match-btn').forEach(button => {
            button.onclick = (e) => editMatch(e.target.dataset.id);
        });
        document.querySelectorAll('.delete-match-btn').forEach(button => {
            button.onclick = (e) => deleteMatch(e.target.dataset.id);
        });
    }

    // --- Form Visibility and Reset ---
    addMatchBtn.onclick = async () => {
        matchFormContainer.style.display = 'block';
        matchForm.reset();
        editingMatchId = null;
        matchIdInput.value = '';
        inningsSection.style.display = 'none'; // Hide innings section for new match until saved
        inningsListDiv.innerHTML = '<p>No innings added yet.</p>'; // Clear innings list

        // Populate dropdowns for new match
        await loadAndPopulateDropdowns();
        populateDropdown(winnerSelect, allTeams, null, true); // No winner initially
        populateDropdown(tossWinnerSelect, allTeams, null, true); // No toss winner initially
        populateDropdown(manOfTheMatchSelect, allPlayers, null, true); // No MoM initially
    };

    cancelMatchFormBtn.onclick = () => {
        matchFormContainer.style.display = 'none';
        inningsSection.style.display = 'none'; // Hide innings section
    };

    // --- Load Players and Teams for Dropdowns ---
    async function loadAndPopulateDropdowns(selectedTeam1 = null, selectedTeam2 = null, selectedMoM = null, selectedTossWinner = null) {
        allPlayers = await apiRequest('/players');
        allTeams = await apiRequest('/teams');

        if (allPlayers && allTeams) {
            populateDropdown(team1Select, allTeams, selectedTeam1);
            populateDropdown(team2Select, allTeams, selectedTeam2);

            // Winner, MoM, Toss Winner need options for all teams/players, plus "None"
            populateDropdown(winnerSelect, allTeams, selectedTeam1, true); // Teams in dropdown
            populateDropdown(manOfTheMatchSelect, allPlayers, selectedMoM, true); // Players in dropdown
            populateDropdown(tossWinnerSelect, allTeams, selectedTossWinner, true); // Teams in dropdown

            // Update winner/toss winner options based on selected teams if editing
            updateWinnerOptions();
            updateTossWinnerOptions();
        }
    }

    // --- Update Winner & Toss Winner Options Dynamically ---
    function updateWinnerOptions() {
        const selectedTeam1Id = team1Select.value;
        const selectedTeam2Id = team2Select.value;
        let availableWinners = [{ _id: '', name: 'Select Winner (Optional)' }]; // Add None option
        if (selectedTeam1Id) availableWinners.push(allTeams.find(t => t._id === selectedTeam1Id));
        if (selectedTeam2Id) availableWinners.push(allTeams.find(t => t._id === selectedTeam2Id));
        populateDropdown(winnerSelect, availableWinners, winnerSelect.value, true);
    }

    function updateTossWinnerOptions() {
        const selectedTeam1Id = team1Select.value;
        const selectedTeam2Id = team2Select.value;
        let availableTossWinners = [{ _id: '', name: 'Select Toss Winner (Optional)' }]; // Add None option
        if (selectedTeam1Id) availableTossWinners.push(allTeams.find(t => t._id === selectedTeam1Id));
        if (selectedTeam2Id) availableTossWinners.push(allTeams.find(t => t._id === selectedTeam2Id));
        populateDropdown(tossWinnerSelect, availableTossWinners, tossWinnerSelect.value, true);
    }

    team1Select.addEventListener('change', updateWinnerOptions);
    team2Select.addEventListener('change', updateWinnerOptions);
    team1Select.addEventListener('change', updateTossWinnerOptions);
    team2Select.addEventListener('change', updateTossWinnerOptions);


    // --- Handle Match Form Submission (Add/Edit) ---
    matchForm.onsubmit = async (e) => {
        e.preventDefault();

        const matchData = {
            matchDate: matchDateInput.value,
            venue: matchVenueInput.value,
            format: matchFormatSelect.value,
            team1: team1Select.value,
            team2: team2Select.value,
            winner: winnerSelect.value || undefined, // Send undefined if 'Select Winner'
            manOfTheMatch: manOfTheMatchSelect.value || undefined,
            tossWinner: tossWinnerSelect.value || undefined,
            tossDecision: tossDecisionSelect.value || undefined,
            matchNotes: matchNotesInput.value
        };

        let result = null;
        if (editingMatchId) {
            result = await apiRequest(`/matches/${editingMatchId}`, 'PUT', matchData);
        } else {
            result = await apiRequest('/matches', 'POST', matchData);
        }

        if (result) {
            editingMatchId = result._id; // Set ID for potentially adding innings later
            matchIdInput.value = result._id; // Update hidden ID

            // Show innings section after basic match details are saved/updated
            inningsSection.style.display = 'block';

            // Re-fetch and re-render match list
            await fetchAndRenderMatches();

            // Re-populate form with updated populated data for consistency (MoM, winner names etc)
            await editMatch(editingMatchId);
            alert(`Match ${editingMatchId ? 'updated' : 'added'} successfully! You can now add innings details below.`);
        }
    };

    // --- Edit Match Function ---
    async function editMatch(id) {
        const match = await apiRequest(`/matches/${id}`);
        if (match) {
            matchDateInput.value = formatDateForInput(match.matchDate);
            matchVenueInput.value = match.venue;
            matchFormatSelect.value = match.format;

            editingMatchId = match._id;
            matchIdInput.value = match._id;

            // Load and populate dropdowns with current match selections
            await loadAndPopulateDropdowns(
                match.team1 ? match.team1._id : null,
                match.team2 ? match.team2._id : null,
                match.manOfTheMatch ? match.manOfTheMatch._id : null,
                match.tossWinner ? match.tossWinner._id : null
            );

            // Set specific values for Winner, MoM, Toss Winner, Toss Decision, Match Notes
            winnerSelect.value = match.winner ? match.winner._id : '';
            manOfTheMatchSelect.value = match.manOfTheMatch ? match.manOfTheMatch._id : '';
            tossWinnerSelect.value = match.tossWinner ? match.tossWinner._id : '';
            tossDecisionSelect.value = match.tossDecision || '';
            matchNotesInput.value = match.matchNotes || '';

            matchFormContainer.style.display = 'block';
            inningsSection.style.display = 'block'; // Show innings section

            renderInningsForms(match.innings || []); // Render existing innings
        }
    }

    // --- Delete Match Function ---
    async function deleteMatch(id) {
        if (confirm('Are you sure you want to delete this match and all its associated stats?')) {
            const result = await apiRequest(`/matches/${id}`, 'DELETE');
            if (result) {
                await fetchAndRenderMatches();
                alert('Match deleted successfully!');
                // If the deleted match was the one being edited, hide form
                if (editingMatchId === id) {
                    matchFormContainer.style.display = 'none';
                    inningsSection.style.display = 'none';
                    editingMatchId = null;
                }
            }
        }
    }

    // --- Innings Management (Dynamic Forms) ---
    function renderInningsForms(inningsData) {
        inningsListDiv.innerHTML = ''; // Clear existing innings forms
        if (inningsData.length === 0) {
            inningsListDiv.innerHTML = '<p>No innings added yet.</p>';
        }

        inningsData.forEach((innings, index) => {
            const inningsDiv = document.createElement('div');
            inningsDiv.className = 'innings-entry';
            inningsDiv.innerHTML = `
                <h4>Innings ${innings.inningsNumber} - ${innings.battingTeam ? innings.battingTeam.name : 'N/A'}</h4>
                <input type="hidden" class="innings-index" value="${index}">
                <input type="hidden" class="innings-id" value="${innings._id || ''}">

                <div class="innings-row">
                    <div class="innings-group">
                        <label>Batting Team:</label>
                        <select class="innings-batting-team" required></select>
                    </div>
                    <div class="innings-group">
                        <label>Bowling Team:</label>
                        <select class="innings-bowling-team" required></select>
                    </div>
                    <div class="innings-group">
                        <label>Runs Scored:</label>
                        <input type="number" class="innings-runs" value="${innings.runsScored || 0}">
                    </div>
                </div>

                <div class="innings-row">
                    <div class="innings-group">
                        <label>Wickets Lost:</label>
                        <input type="number" class="innings-wickets" value="${innings.wicketsLost || 0}">
                    </div>
                    <div class="innings-group">
                        <label>Overs Bowled:</label>
                        <input type="text" class="innings-overs" value="${innings.oversBowled || 0}" placeholder="e.g., 20.3">
                    </div>
                    <div class="innings-group">
                        <label>&nbsp;</label>
                        <div class="innings-checkboxes">
                            <label><input type="checkbox" class="innings-declared" ${innings.isDeclared ? 'checked' : ''}> Declared</label>
                            <label><input type="checkbox" class="innings-follow-on" ${innings.isFollowOn ? 'checked' : ''}> Follow-on</label>
                        </div>
                    </div>
                </div>

                <h5>Player Stats for this Innings:</h5>
                <button type="button" class="btn btn-info btn-sm add-player-stats-btn" data-innings-index="${index}">Add Player Stats</button>
                <div class="player-stats-list">
                    ${(innings.playerStats || []).map((pStat, pIndex) => `
                        <div class="player-stats-entry">
                            <input type="hidden" class="player-stats-id" value="${pStat._id || ''}">
                            <input type="hidden" class="player-stats-index" value="${pIndex}">
                            <h6>Player: ${pStat.player ? pStat.player.name : 'N/A'} <button type="button" class="btn btn-danger btn-sm remove-player-stats-btn">Remove</button></h6>

                            <div class="player-stats-row">
                                <div class="player-stats-group">
                                    <label>Player:</label>
                                    <select class="player-stats-player" required></select>
                                </div>
                                <div class="player-stats-group">
                                    <label>Runs:</label>
                                    <input type="number" class="player-stats-runs" value="${pStat.runs || 0}">
                                </div>
                                <div class="player-stats-group">
                                    <label>Balls:</label>
                                    <input type="number" class="player-stats-balls" value="${pStat.balls || 0}">
                                </div>
                            </div>

                            <div class="player-stats-row">
                                <div class="player-stats-group">
                                    <label>Fours:</label>
                                    <input type="number" class="player-stats-fours" value="${pStat.fours || 0}">
                                </div>
                                <div class="player-stats-group">
                                    <label>Sixes:</label>
                                    <input type="number" class="player-stats-sixes" value="${pStat.sixes || 0}">
                                </div>
                                <div class="player-stats-group">
                                    <label><input type="checkbox" class="player-stats-not-out" ${pStat.isNotOut ? 'checked' : ''}> Not Out</label>
                                </div>
                            </div>

                            <div class="player-stats-section">
                                <h6>Dismissal Details</h6>
                                <div class="player-stats-row">
                                    <div class="player-stats-group">
                                        <label>Dismissal Type:</label>
                                        <select class="player-stats-dismissal">
                                            <option value="">N/A</option>
                                            <option value="bowled">Bowled</option>
                                            <option value="caught">Caught</option>
                                            <option value="lbw">LBW</option>
                                            <option value="run out">Run Out</option>
                                            <option value="stumped">Stumped</option>
                                            <option value="hit wicket">Hit Wicket</option>
                                            <option value="retired hurt">Retired Hurt</option>
                                            <option value="obstructing the field">Obstructing the Field</option>
                                            <option value="handled the ball">Handled the Ball</option>
                                            <option value="timed out">Timed Out</option>
                                            <option value="did not bat">Did Not Bat</option>
                                        </select>
                                    </div>
                                    <div class="player-stats-group">
                                        <label>Bowler Dismissal:</label>
                                        <select class="player-stats-bowler-dismissal">
                                            <option value="">Select Bowler (Optional)</option>
                                        </select>
                                    </div>
                                    <div class="player-stats-group">
                                        <label>Fielder Dismissal:</label>
                                        <select class="player-stats-fielder-dismissal">
                                            <option value="">Select Fielder (Optional)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="player-stats-section">
                                <h6>Bowling Stats</h6>
                                <div class="player-stats-row">
                                    <div class="player-stats-group">
                                        <label>Wickets:</label>
                                        <input type="number" class="player-stats-wickets" value="${pStat.wickets || 0}">
                                    </div>
                                    <div class="player-stats-group">
                                        <label>Runs Conceded:</label>
                                        <input type="number" class="player-stats-runs-conceded" value="${pStat.runsConceded || 0}">
                                    </div>
                                    <div class="player-stats-group">
                                        <label>Overs:</label>
                                        <input type="text" class="player-stats-overs-bowled" value="${pStat.overs || 0}">
                                    </div>
                                </div>
                                <div class="player-stats-row">
                                    <div class="player-stats-group">
                                        <label>Maidens:</label>
                                        <input type="number" class="player-stats-maidens" value="${pStat.maidens || 0}">
                                    </div>
                                    <div class="player-stats-group">
                                        <label>&nbsp;</label>
                                        <div></div>
                                    </div>
                                    <div class="player-stats-group">
                                        <label>&nbsp;</label>
                                        <div></div>
                                    </div>
                                </div>
                            </div>

                            <div class="player-stats-section">
                                <h6>Fielding Stats</h6>
                                <div class="player-stats-row">
                                    <div class="player-stats-group">
                                        <label>Catches:</label>
                                        <input type="number" class="player-stats-catches" value="${pStat.catches || 0}">
                                    </div>
                                    <div class="player-stats-group">
                                        <label>Stumpings:</label>
                                        <input type="number" class="player-stats-stumpings" value="${pStat.stumpings || 0}">
                                    </div>
                                    <div class="player-stats-group">
                                        <label>Run Outs:</label>
                                        <input type="number" class="player-stats-run-outs" value="${pStat.runOuts || 0}">
                                    </div>
                                </div>
                            </div>

                            <div class="scoring-controls">
                                <h6>Quick Scoring Controls</h6>
                                <div class="scoring-buttons">
                                    <button type="button" class="scoring-btn runs" data-runs="1">1</button>
                                    <button type="button" class="scoring-btn runs" data-runs="2">2</button>
                                    <button type="button" class="scoring-btn runs" data-runs="3">3</button>
                                    <button type="button" class="scoring-btn runs" data-runs="4">4</button>
                                    <button type="button" class="scoring-btn runs" data-runs="6">6</button>
                                    <button type="button" class="scoring-btn wicket" data-wicket="true">W</button>
                                    <button type="button" class="scoring-btn extras" data-extra="wide">Wide</button>
                                    <button type="button" class="scoring-btn extras" data-extra="no-ball">No Ball</button>
                                    <button type="button" class="scoring-btn extras" data-extra="bye">Bye</button>
                                    <button type="button" class="scoring-btn extras" data-extra="leg-bye">Leg Bye</button>
                                </div>
                                
                                <div class="scoring-info">
                                    <div class="current-stats">
                                        <div class="stat-item">
                                            <span class="stat-label">Runs:</span>
                                            <span class="stat-value" id="current-runs-${pIndex}">${pStat.runs || 0}</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">Balls:</span>
                                            <span class="stat-value" id="current-balls-${pIndex}">${pStat.balls || 0}</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">4s:</span>
                                            <span class="stat-value" id="current-fours-${pIndex}">${pStat.fours || 0}</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">6s:</span>
                                            <span class="stat-value" id="current-sixes-${pIndex}">${pStat.sixes || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="dismissal-controls">
                                    <select class="dismissal-type-select" data-player-index="${pIndex}">
                                        <option value="">Select Dismissal</option>
                                        <option value="bowled">Bowled</option>
                                        <option value="caught">Caught</option>
                                        <option value="lbw">LBW</option>
                                        <option value="run out">Run Out</option>
                                        <option value="stumped">Stumped</option>
                                        <option value="hit wicket">Hit Wicket</option>
                                        <option value="retired hurt">Retired Hurt</option>
                                        <option value="obstructing the field">Obstructing the Field</option>
                                        <option value="handled the ball">Handled the Ball</option>
                                        <option value="timed out">Timed Out</option>
                                        <option value="did not bat">Did Not Bat</option>
                                    </select>
                                    <select class="bowler-select" data-player-index="${pIndex}">
                                        <option value="">Select Bowler</option>
                                    </select>
                                    <select class="fielder-select" data-player-index="${pIndex}">
                                        <option value="">Select Fielder</option>
                                    </select>
                                </div>

                                <div class="scoring-actions">
                                    <button type="button" class="btn btn-success btn-sm update-stats-btn" data-player-index="${pIndex}">Update Stats</button>
                                    <button type="button" class="btn btn-secondary btn-sm reset-stats-btn" data-player-index="${pIndex}">Reset</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-danger btn-sm remove-innings-btn">Remove Innings</button>
                <hr>
            `;
            inningsListDiv.appendChild(inningsDiv);

            // Populate player dropdowns within this innings form
            populateDropdown(inningsDiv.querySelector('.innings-batting-team'), allTeams, innings.battingTeam ? innings.battingTeam._id : null);
            populateDropdown(inningsDiv.querySelector('.innings-bowling-team'), allTeams, innings.bowlingTeam ? innings.bowlingTeam._id : null);

            inningsDiv.querySelectorAll('.player-stats-player').forEach(select => populateDropdown(select, allPlayers, select.dataset.selectedPlayerId || null));
            inningsDiv.querySelectorAll('.player-stats-bowler-dismissal').forEach(select => populateDropdown(select, allPlayers, select.dataset.selectedBowlerId || null, true));
            inningsDiv.querySelectorAll('.player-stats-fielder-dismissal').forEach(select => populateDropdown(select, allPlayers, select.dataset.selectedFielderId || null, true));
        });

        // Re-attach event listeners after re-rendering
        attachInningsEventListeners();
        
        // Populate dismissal dropdowns
        document.querySelectorAll('.bowler-select, .fielder-select').forEach(select => {
            populateDropdown(select, allPlayers, null, true);
        });
    }

    function attachInningsEventListeners() {
        document.querySelectorAll('.add-player-stats-btn').forEach(btn => {
            btn.onclick = (e) => addPlayerStatsForm(parseInt(e.target.dataset.inningsIndex));
        });
        document.querySelectorAll('.remove-innings-btn').forEach(btn => {
            btn.onclick = (e) => removeInningsForm(e.target.closest('.innings-entry'));
        });
        document.querySelectorAll('.remove-player-stats-btn').forEach(btn => {
            btn.onclick = (e) => removePlayerStatsForm(e.target.closest('.player-stats-entry'));
        });

        // Set selected values for player stats dropdowns (after population)
        document.querySelectorAll('.player-stats-entry').forEach(entry => {
            const playerStatId = entry.querySelector('.player-stats-id').value;
            const inningsData = editingMatchId ? (matchFormContainer.currentMatchData.innings || []) : [];
            const playerStat = inningsData.flatMap(i => i.playerStats).find(ps => ps._id === playerStatId);

            if (playerStat) {
                const playerSelect = entry.querySelector('.player-stats-player');
                populateDropdown(playerSelect, allPlayers, playerStat.player ? playerStat.player._id : null);

                const dismissalSelect = entry.querySelector('.player-stats-dismissal');
                if(playerStat.dismissalType) dismissalSelect.value = playerStat.dismissalType;

                const bowlerSelect = entry.querySelector('.player-stats-bowler-dismissal');
                populateDropdown(bowlerSelect, allPlayers, playerStat.bowlerDismissal ? playerStat.bowlerDismissal._id : null, true);

                const fielderSelect = entry.querySelector('.player-stats-fielder-dismissal');
                populateDropdown(fielderSelect, allPlayers, playerStat.fielderDismissal ? playerStat.fielderDismissal._id : null, true);
            }
        });

        // Attach scoring control event listeners
        attachScoringEventListeners();
    }

    function attachScoringEventListeners() {
        // Scoring buttons
        document.querySelectorAll('.scoring-btn').forEach(btn => {
            btn.onclick = (e) => handleScoringButton(e);
        });

        // Update stats buttons
        document.querySelectorAll('.update-stats-btn').forEach(btn => {
            btn.onclick = (e) => updatePlayerStats(e);
        });

        // Reset stats buttons
        document.querySelectorAll('.reset-stats-btn').forEach(btn => {
            btn.onclick = (e) => resetPlayerStats(e);
        });
    }

    function handleScoringButton(e) {
        const btn = e.target;
        const playerStatsEntry = btn.closest('.player-stats-entry');
        const runsInput = playerStatsEntry.querySelector('.player-stats-runs');
        const ballsInput = playerStatsEntry.querySelector('.player-stats-balls');
        const foursInput = playerStatsEntry.querySelector('.player-stats-fours');
        const sixesInput = playerStatsEntry.querySelector('.player-stats-sixes');
        
        let currentRuns = parseInt(runsInput.value) || 0;
        let currentBalls = parseInt(ballsInput.value) || 0;
        let currentFours = parseInt(foursInput.value) || 0;
        let currentSixes = parseInt(sixesInput.value) || 0;

        if (btn.classList.contains('runs')) {
            const runs = parseInt(btn.dataset.runs);
            currentRuns += runs;
            currentBalls += 1;
            
            // Update boundaries
            if (runs === 4) currentFours += 1;
            if (runs === 6) currentSixes += 1;
            
        } else if (btn.classList.contains('wicket')) {
            // Handle wicket - no runs, no balls added
            const dismissalSelect = playerStatsEntry.querySelector('.dismissal-type-select');
            if (dismissalSelect) {
                dismissalSelect.value = 'bowled'; // Default dismissal type
            }
        } else if (btn.classList.contains('extras')) {
            // Handle extras - no balls added, no runs to batsman
            const extraType = btn.dataset.extra;
            console.log(`Extra: ${extraType}`);
        }

        // Update display values
        runsInput.value = currentRuns;
        ballsInput.value = currentBalls;
        foursInput.value = currentFours;
        sixesInput.value = currentSixes;

        // Update the display in scoring info
        updateScoringDisplay(playerStatsEntry, currentRuns, currentBalls, currentFours, currentSixes);

        // Add visual feedback
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 200);
    }

    function updateScoringDisplay(playerStatsEntry, runs, balls, fours, sixes) {
        const displayElements = playerStatsEntry.querySelectorAll('.current-runs-display, .current-balls-display, .current-fours-display, .current-sixes-display');
        const statValues = [runs, balls, fours, sixes];
        
        displayElements.forEach((element, index) => {
            if (element) {
                element.textContent = statValues[index];
            }
        });
    }

    function updatePlayerStats(e) {
        const btn = e.target;
        const playerStatsEntry = btn.closest('.player-stats-entry');
        
        // Get values from scoring controls
        const dismissalSelect = playerStatsEntry.querySelector('.dismissal-type-select');
        const bowlerSelect = playerStatsEntry.querySelector('.bowler-select');
        const fielderSelect = playerStatsEntry.querySelector('.fielder-select');
        
        // Update the main form fields
        const mainDismissalSelect = playerStatsEntry.querySelector('.player-stats-dismissal');
        const mainBowlerSelect = playerStatsEntry.querySelector('.player-stats-bowler-dismissal');
        const mainFielderSelect = playerStatsEntry.querySelector('.player-stats-fielder-dismissal');
        
        if (dismissalSelect && mainDismissalSelect) {
            mainDismissalSelect.value = dismissalSelect.value;
        }
        if (bowlerSelect && mainBowlerSelect) {
            mainBowlerSelect.value = bowlerSelect.value;
        }
        if (fielderSelect && mainFielderSelect) {
            mainFielderSelect.value = fielderSelect.value;
        }
        
        alert('Player stats updated successfully!');
    }

    function resetPlayerStats(e) {
        const btn = e.target;
        const playerStatsEntry = btn.closest('.player-stats-entry');
        
        // Reset all scoring inputs
        const inputs = playerStatsEntry.querySelectorAll('.player-stats-runs, .player-stats-balls, .player-stats-fours, .player-stats-sixes');
        inputs.forEach(input => input.value = 0);
        
        // Reset dismissal controls
        const dismissalSelects = playerStatsEntry.querySelectorAll('.dismissal-type-select, .player-stats-dismissal');
        dismissalSelects.forEach(select => select.value = '');
        
        // Update display
        updateScoringDisplay(playerStatsEntry, 0, 0, 0, 0);
        
        alert('Player stats reset!');
    }

    function attachScoringEventListenersToElement(element) {
        // Scoring buttons
        element.querySelectorAll('.scoring-btn').forEach(btn => {
            btn.onclick = (e) => handleScoringButton(e);
        });

        // Update stats buttons
        element.querySelectorAll('.update-stats-btn').forEach(btn => {
            btn.onclick = (e) => updatePlayerStats(e);
        });

        // Reset stats buttons
        element.querySelectorAll('.reset-stats-btn').forEach(btn => {
            btn.onclick = (e) => resetPlayerStats(e);
        });
    }


    addInningsBtn.onclick = () => {
        if (!editingMatchId) {
            alert('Please save the basic match details first!');
            return;
        }
        const currentInningsCount = inningsListDiv.querySelectorAll('.innings-entry').length;
        const newInnings = {
            inningsNumber: currentInningsCount + 1,
            runsScored: 0,
            wicketsLost: 0,
            oversBowled: 0,
            isDeclared: false,
            isFollowOn: false,
            playerStats: []
        };
        // Add to temporary structure for rendering
        if (!matchFormContainer.currentMatchData.innings) {
            matchFormContainer.currentMatchData.innings = [];
        }
        matchFormContainer.currentMatchData.innings.push(newInnings);
        renderInningsForms(matchFormContainer.currentMatchData.innings);
    };

    function addPlayerStatsForm(inningsIndex) {
        const inningsDiv = inningsListDiv.querySelectorAll('.innings-entry')[inningsIndex];
        const playerStatsListDiv = inningsDiv.querySelector('.player-stats-list');
        const newPlayerStatEntry = document.createElement('div');
        newPlayerStatEntry.className = 'player-stats-entry';
        newPlayerStatEntry.innerHTML = `
            <h6>New Player Stats <button type="button" class="btn btn-danger btn-sm remove-player-stats-btn">Remove</button></h6>

            <div class="player-stats-row">
                <div class="player-stats-group">
                    <label>Player:</label>
                    <select class="player-stats-player" required></select>
                </div>
                <div class="player-stats-group">
                    <label>Runs:</label>
                    <input type="number" class="player-stats-runs" value="0">
                </div>
                <div class="player-stats-group">
                    <label>Balls:</label>
                    <input type="number" class="player-stats-balls" value="0">
                </div>
            </div>

            <div class="player-stats-row">
                <div class="player-stats-group">
                    <label>Fours:</label>
                    <input type="number" class="player-stats-fours" value="0">
                </div>
                <div class="player-stats-group">
                    <label>Sixes:</label>
                    <input type="number" class="player-stats-sixes" value="0">
                </div>
                <div class="player-stats-group">
                    <label><input type="checkbox" class="player-stats-not-out"> Not Out</label>
                </div>
            </div>

            <div class="player-stats-section">
                <h6>Dismissal Details</h6>
                <div class="player-stats-row">
                    <div class="player-stats-group">
                        <label>Dismissal Type:</label>
                        <select class="player-stats-dismissal">
                            <option value="">N/A</option>
                            <option value="bowled">Bowled</option>
                            <option value="caught">Caught</option>
                            <option value="lbw">LBW</option>
                            <option value="run out">Run Out</option>
                            <option value="stumped">Stumped</option>
                            <option value="hit wicket">Hit Wicket</option>
                            <option value="retired hurt">Retired Hurt</option>
                            <option value="obstructing the field">Obstructing the Field</option>
                            <option value="handled the ball">Handled the Ball</option>
                            <option value="timed out">Timed Out</option>
                            <option value="did not bat">Did Not Bat</option>
                        </select>
                    </div>
                    <div class="player-stats-group">
                        <label>Bowler Dismissal:</label>
                        <select class="player-stats-bowler-dismissal">
                            <option value="">Select Bowler (Optional)</option>
                        </select>
                    </div>
                    <div class="player-stats-group">
                        <label>Fielder Dismissal:</label>
                        <select class="player-stats-fielder-dismissal">
                            <option value="">Select Fielder (Optional)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="player-stats-section">
                <h6>Bowling Stats</h6>
                <div class="player-stats-row">
                    <div class="player-stats-group">
                        <label>Wickets:</label>
                        <input type="number" class="player-stats-wickets" value="0">
                    </div>
                    <div class="player-stats-group">
                        <label>Runs Conceded:</label>
                        <input type="number" class="player-stats-runs-conceded" value="0">
                    </div>
                    <div class="player-stats-group">
                        <label>Overs:</label>
                        <input type="text" class="player-stats-overs-bowled" value="0">
                    </div>
                </div>
                <div class="player-stats-row">
                    <div class="player-stats-group">
                        <label>Maidens:</label>
                        <input type="number" class="player-stats-maidens" value="0">
                    </div>
                    <div class="player-stats-group">
                        <label>&nbsp;</label>
                        <div></div>
                    </div>
                    <div class="player-stats-group">
                        <label>&nbsp;</label>
                        <div></div>
                    </div>
                </div>
            </div>

            <div class="player-stats-section">
                <h6>Fielding Stats</h6>
                <div class="player-stats-row">
                    <div class="player-stats-group">
                        <label>Catches:</label>
                        <input type="number" class="player-stats-catches" value="0">
                    </div>
                    <div class="player-stats-group">
                        <label>Stumpings:</label>
                        <input type="number" class="player-stats-stumpings" value="0">
                    </div>
                    <div class="player-stats-group">
                        <label>Run Outs:</label>
                        <input type="number" class="player-stats-run-outs" value="0">
                    </div>
                </div>
            </div>

            <div class="scoring-controls">
                <h6>Quick Scoring Controls</h6>
                <div class="scoring-buttons">
                    <button type="button" class="scoring-btn runs" data-runs="1">1</button>
                    <button type="button" class="scoring-btn runs" data-runs="2">2</button>
                    <button type="button" class="scoring-btn runs" data-runs="3">3</button>
                    <button type="button" class="scoring-btn runs" data-runs="4">4</button>
                    <button type="button" class="scoring-btn runs" data-runs="6">6</button>
                    <button type="button" class="scoring-btn wicket" data-wicket="true">W</button>
                    <button type="button" class="scoring-btn extras" data-extra="wide">Wide</button>
                    <button type="button" class="scoring-btn extras" data-extra="no-ball">No Ball</button>
                    <button type="button" class="scoring-btn extras" data-extra="bye">Bye</button>
                    <button type="button" class="scoring-btn extras" data-extra="leg-bye">Leg Bye</button>
                </div>
                
                <div class="scoring-info">
                    <div class="current-stats">
                        <div class="stat-item">
                            <span class="stat-label">Runs:</span>
                            <span class="stat-value current-runs-display">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Balls:</span>
                            <span class="stat-value current-balls-display">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">4s:</span>
                            <span class="stat-value current-fours-display">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">6s:</span>
                            <span class="stat-value current-sixes-display">0</span>
                        </div>
                    </div>
                </div>

                <div class="dismissal-controls">
                    <select class="dismissal-type-select">
                        <option value="">Select Dismissal</option>
                        <option value="bowled">Bowled</option>
                        <option value="caught">Caught</option>
                        <option value="lbw">LBW</option>
                        <option value="run out">Run Out</option>
                        <option value="stumped">Stumped</option>
                        <option value="hit wicket">Hit Wicket</option>
                        <option value="retired hurt">Retired Hurt</option>
                        <option value="obstructing the field">Obstructing the Field</option>
                        <option value="handled the ball">Handled the Ball</option>
                        <option value="timed out">Timed Out</option>
                        <option value="did not bat">Did Not Bat</option>
                    </select>
                    <select class="bowler-select">
                        <option value="">Select Bowler</option>
                    </select>
                    <select class="fielder-select">
                        <option value="">Select Fielder</option>
                    </select>
                </div>

                <div class="scoring-actions">
                    <button type="button" class="btn btn-success btn-sm update-stats-btn">Update Stats</button>
                    <button type="button" class="btn btn-secondary btn-sm reset-stats-btn">Reset</button>
                </div>
            </div>
        `;
        playerStatsListDiv.appendChild(newPlayerStatEntry);

        // Populate dropdowns in the newly added form
        populateDropdown(newPlayerStatEntry.querySelector('.player-stats-player'), allPlayers);
        populateDropdown(newPlayerStatEntry.querySelector('.player-stats-bowler-dismissal'), allPlayers, null, true);
        populateDropdown(newPlayerStatEntry.querySelector('.player-stats-fielder-dismissal'), allPlayers, null, true);

        // Populate dismissal dropdowns for new form
        populateDropdown(newPlayerStatEntry.querySelector('.bowler-select'), allPlayers, null, true);
        populateDropdown(newPlayerStatEntry.querySelector('.fielder-select'), allPlayers, null, true);

        // Attach event listener for the new remove button
        newPlayerStatEntry.querySelector('.remove-player-stats-btn').onclick = (e) => removePlayerStatsForm(newPlayerStatEntry);

        // Attach scoring event listeners for the new form
        attachScoringEventListenersToElement(newPlayerStatEntry);
    }

    function removeInningsForm(inningsDiv) {
        if (confirm('Are you sure you want to remove this innings and all its player stats?')) {
            inningsDiv.remove();
            // Re-index remaining innings if needed (not strictly necessary for MongoDB save, but good for display)
        }
    }

    function removePlayerStatsForm(playerStatsDiv) {
        playerStatsDiv.remove();
    }


    // --- Collect Data from Innings Forms ---
    function collectInningsData() {
        const innings = [];
        document.querySelectorAll('.innings-entry').forEach((inningsDiv, inningsIndex) => {
            const playerStats = [];
            inningsDiv.querySelectorAll('.player-stats-entry').forEach(pStatDiv => {
                const isNotOut = pStatDiv.querySelector('.player-stats-not-out').checked;
                const dismissalType = pStatDiv.querySelector('.player-stats-dismissal').value;

                playerStats.push({
                    player: pStatDiv.querySelector('.player-stats-player').value,
                    runs: parseInt(pStatDiv.querySelector('.player-stats-runs').value) || 0,
                    balls: parseInt(pStatDiv.querySelector('.player-stats-balls').value) || 0,
                    fours: parseInt(pStatDiv.querySelector('.player-stats-fours').value) || 0,
                    sixes: parseInt(pStatDiv.querySelector('.player-stats-sixes').value) || 0,
                    isNotOut: isNotOut,
                    // If not out, ensure dismissalType is N/A or empty
                    dismissalType: isNotOut ? (dismissalType === 'did not bat' ? 'did not bat' : 'not out') : (dismissalType || undefined),
                    bowlerDismissal: pStatDiv.querySelector('.player-stats-bowler-dismissal').value || undefined,
                    fielderDismissal: pStatDiv.querySelector('.player-stats-fielder-dismissal').value || undefined,

                    wickets: parseInt(pStatDiv.querySelector('.player-stats-wickets').value) || 0,
                    runsConceded: parseInt(pStatDiv.querySelector('.player-stats-runs-conceded').value) || 0,
                    overs: parseFloat(pStatDiv.querySelector('.player-stats-overs-bowled').value) || 0,
                    maidens: parseInt(pStatDiv.querySelector('.player-stats-maidens').value) || 0,

                    catches: parseInt(pStatDiv.querySelector('.player-stats-catches').value) || 0,
                    stumpings: parseInt(pStatDiv.querySelector('.player-stats-stumpings').value) || 0,
                    runOuts: parseInt(pStatDiv.querySelector('.player-stats-run-outs').value) || 0,
                });
            });

            innings.push({
                inningsNumber: parseInt(inningsDiv.querySelector('.innings-index').value) + 1, // Correct innings number
                battingTeam: inningsDiv.querySelector('.innings-batting-team').value,
                bowlingTeam: inningsDiv.querySelector('.innings-bowling-team').value,
                runsScored: parseInt(inningsDiv.querySelector('.innings-runs').value) || 0,
                wicketsLost: parseInt(inningsDiv.querySelector('.innings-wickets').value) || 0,
                oversBowled: parseFloat(inningsDiv.querySelector('.innings-overs').value) || 0,
                isDeclared: inningsDiv.querySelector('.innings-declared').checked,
                isFollowOn: inningsDiv.querySelector('.innings-follow-on').checked,
                playerStats: playerStats
            });
        });
        return innings;
    }


    // --- Override Match Form Submission for Innings Data ---
    // Change `matchForm.onsubmit` to include innings data
    matchForm.onsubmit = async (e) => {
        e.preventDefault();

        const matchData = {
            matchDate: matchDateInput.value,
            venue: matchVenueInput.value,
            format: matchFormatSelect.value,
            team1: team1Select.value,
            team2: team2Select.value,
            winner: winnerSelect.value || undefined,
            manOfTheMatch: manOfTheMatchSelect.value || undefined,
            tossWinner: tossWinnerSelect.value || undefined,
            tossDecision: tossDecisionSelect.value || undefined,
            matchNotes: matchNotesInput.value,
            innings: collectInningsData() // Collect all innings and player stats
        };

        let result = null;
        if (editingMatchId) {
            result = await apiRequest(`/matches/${editingMatchId}`, 'PUT', matchData);
        } else {
            result = await apiRequest('/matches', 'POST', matchData);
        }

        if (result) {
            editingMatchId = result._id;
            matchIdInput.value = result._id;
            matchFormContainer.currentMatchData = result; // Store current match data for rendering innings
            inningsSection.style.display = 'block';
            await fetchAndRenderMatches(); // Refresh the table
            await editMatch(editingMatchId); // Re-populate to show full current state including populated fields
            alert(`Match ${editingMatchId ? 'updated' : 'added'} successfully! Innings details are also saved.`);
        }
    };

    // --- Stats Button Event Listeners ---
    document.getElementById('view-batsman-stats-btn').onclick = () => {
        window.location.href = 'batsman-stats.html';
    };

    document.getElementById('view-bowler-stats-btn').onclick = () => {
        window.location.href = 'bowler-stats.html';
    };

    document.getElementById('add-batsman-stats-btn').onclick = () => {
        // Open batsman stats page with a modal or redirect to add form
        window.open('batsman-stats.html', '_blank');
    };

    document.getElementById('add-bowler-stats-btn').onclick = () => {
        // Open bowler stats page with a modal or redirect to add form
        window.open('bowler-stats.html', '_blank');
    };

    // --- Initial Load ---
    fetchAndRenderMatches();
    // Cache current match data on the form container for easy access when rendering nested innings
    matchFormContainer.currentMatchData = {};
});