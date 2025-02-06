(function() {
  // Create Voice Settings Modal HTML and behavior
  function createVoiceSettingsModal() {
    const modal = document.createElement('div');
    modal.id = 'voice-settings-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h4>Voice Settings</h4>
        <div class="settings-form">
          <label class="checkbox-label">
            Enable Voice Pick Command:
            <input type="checkbox" id="voice-pick-toggle">
          </label>
          <label>
            Blacklisted Voices (comma separated):
            <input type="text" id="blacklisted-voices" placeholder="e.g., Google US, Microsoft David">
          </label>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="save-voice-settings" class="control-btn add-btn">Save Settings</button>
            <button id="close-voice-settings" class="control-btn clear-btn">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners for modal interactions
    document.getElementById('voice-settings-btn').addEventListener('click', function() {
      loadVoiceSettings();
      modal.style.display = 'block';
    });

    document.getElementById('close-voice-settings').addEventListener('click', function() {
      modal.style.display = 'none';
    });

    window.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    document.getElementById('save-voice-settings').addEventListener('click', function() {
      const voicePickToggle = document.getElementById('voice-pick-toggle').checked;
      const blacklistInput = document.getElementById('blacklisted-voices').value;
      const blacklist = blacklistInput.split(',').map(s => s.trim()).filter(s => s);
      localStorage.setItem('voicePickEnabled', voicePickToggle ? 'true' : 'false');
      localStorage.setItem('blacklistedVoices', JSON.stringify(blacklist));
      modal.style.display = 'none';
    });
  }

  function loadVoiceSettings() {
    const voicePickToggle = document.getElementById('voice-pick-toggle');
    const blacklistInput = document.getElementById('blacklisted-voices');
    voicePickToggle.checked = localStorage.getItem('voicePickEnabled') === 'true';
    const blacklist = JSON.parse(localStorage.getItem('blacklistedVoices') || '[]');
    blacklistInput.value = blacklist.join(', ');
  }

  // Initialize modal on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', createVoiceSettingsModal);

  // Hook into TTS Manager's updateUserVoice to enforce blacklist
  const originalUpdateUserVoice = window.ttsManager.updateUserVoice;
  window.ttsManager.updateUserVoice = function(username, voiceName) {
    const blacklist = JSON.parse(localStorage.getItem('blacklistedVoices') || '[]');
    let voices = window.speechSynthesis.getVoices();
    // Filter allowed voices based on blacklist
    voices = voices.filter(v => !blacklist.includes(v.name));
    if (voices.length === 0) {
      console.warn("All voices are blacklisted!");
      return;
    }
    // If the requested voice is blacklisted or not available, choose a random allowed voice
    if (blacklist.includes(voiceName) || !voices.find(v => v.name === voiceName)) {
      voiceName = voices[Math.floor(Math.random() * voices.length)].name;
    }
    originalUpdateUserVoice(username, voiceName);
  };

  // Expose a helper to perform voice pick command: picks closest matching voice name
  window.pickVoiceByCommand = function(query) {
    // Only perform pick if voice pick enabled
    if (localStorage.getItem('voicePickEnabled') !== 'true') return null;
    const blacklist = JSON.parse(localStorage.getItem('blacklistedVoices') || '[]');
    let voices = window.speechSynthesis.getVoices();
    voices = voices.filter(v => !blacklist.includes(v.name));
    if (!voices.length) return null;
    query = query.toLowerCase();
    // Attempt simple matching: if voice name contains the query
    let bestMatch = voices.find(v => v.name.toLowerCase().includes(query));
    if (!bestMatch) {
      // Otherwise pick the one with shortest Levenshtein distance (simple implementation)
      bestMatch = voices.reduce((prev, curr) => {
        return (levenshtein(curr.name.toLowerCase(), query) < levenshtein(prev.name.toLowerCase(), query)) ? curr : prev;
      });
    }
    return bestMatch ? bestMatch.name : null;
  };

  // Simple Levenshtein distance function
  function levenshtein(a, b) {
    const matrix = [];
    let i;
    for (i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    let j;
    for (j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (i = 1; i <= b.length; i++) {
      for (j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, 
                                  Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
      }
    }
    return matrix[b.length][a.length];
  }
})();