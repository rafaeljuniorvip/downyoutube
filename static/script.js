// ============================================
// DownYouTube - ERP Style JavaScript
// ============================================

const API_BASE = '';

// ============================================
// Audio Player
// ============================================
let audioPlayer = null;
let currentPlaylist = [];
let currentTrackIndex = 0;
let isPlaying = false;

function initAudioPlayer() {
    audioPlayer = document.getElementById('audioElement');

    // Event listeners do player
    audioPlayer.addEventListener('timeupdate', updatePlayerProgress);
    audioPlayer.addEventListener('loadedmetadata', updatePlayerDuration);
    audioPlayer.addEventListener('ended', playNextTrack);
    audioPlayer.addEventListener('play', () => {
        isPlaying = true;
        updatePlayButton();
    });
    audioPlayer.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayButton();
    });

    // Controles do player
    document.getElementById('playerPlayBtn').addEventListener('click', togglePlay);
    document.getElementById('playerPrevBtn').addEventListener('click', playPrevTrack);
    document.getElementById('playerNextBtn').addEventListener('click', playNextTrack);
    document.getElementById('playerCloseBtn').addEventListener('click', closePlayer);

    // Seek bar
    document.getElementById('playerSeek').addEventListener('input', (e) => {
        const seekTime = (e.target.value / 100) * audioPlayer.duration;
        audioPlayer.currentTime = seekTime;
    });

    // Volume
    document.getElementById('playerVolume').addEventListener('input', (e) => {
        audioPlayer.volume = e.target.value / 100;
        updateVolumeIcon();
    });

    document.getElementById('playerMuteBtn').addEventListener('click', toggleMute);
}

function playTrack(filename, playlist = null) {
    // Se passou uma playlist, usa ela; senão cria uma com só essa música
    if (playlist && playlist.length > 0) {
        currentPlaylist = playlist;
        currentTrackIndex = playlist.findIndex(f => f === filename);
        if (currentTrackIndex === -1) currentTrackIndex = 0;
    } else {
        currentPlaylist = [filename];
        currentTrackIndex = 0;
    }

    loadAndPlayCurrentTrack();
}

function loadAndPlayCurrentTrack() {
    if (currentPlaylist.length === 0) return;

    const filename = currentPlaylist[currentTrackIndex];
    const streamUrl = `${API_BASE}/api/stream/${encodeURIComponent(filename)}`;

    // Atualiza título (remove extensão .mp3)
    const title = filename.replace(/\.mp3$/i, '');
    document.getElementById('playerTitle').textContent = title;
    document.getElementById('playerTitle').title = title;

    // Carrega e toca
    audioPlayer.src = streamUrl;
    audioPlayer.play();

    // Mostra o player
    showPlayer();

    // Destaca a música atual na tabela
    highlightCurrentTrack(filename);
}

function showPlayer() {
    document.getElementById('audioPlayer').classList.remove('hidden');
    document.body.classList.add('player-active');
}

function closePlayer() {
    audioPlayer.pause();
    audioPlayer.src = '';
    document.getElementById('audioPlayer').classList.add('hidden');
    document.body.classList.remove('player-active');
    currentPlaylist = [];
    currentTrackIndex = 0;

    // Remove destaque
    document.querySelectorAll('.playing-row').forEach(el => el.classList.remove('playing-row'));
}

function togglePlay() {
    if (audioPlayer.paused) {
        audioPlayer.play();
    } else {
        audioPlayer.pause();
    }
}

function updatePlayButton() {
    const btn = document.getElementById('playerPlayBtn');
    btn.textContent = isPlaying ? '⏸' : '▶';
}

function playNextTrack() {
    if (currentPlaylist.length === 0) return;
    currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    loadAndPlayCurrentTrack();
}

function playPrevTrack() {
    if (currentPlaylist.length === 0) return;
    // Se já tocou mais de 3 segundos, volta ao início da música atual
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
        return;
    }
    currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    loadAndPlayCurrentTrack();
}

function updatePlayerProgress() {
    if (!audioPlayer.duration) return;

    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    document.getElementById('playerSeek').value = progress;
    document.getElementById('playerCurrentTime').textContent = formatTime(audioPlayer.currentTime);
}

function updatePlayerDuration() {
    document.getElementById('playerDuration').textContent = formatTime(audioPlayer.duration);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function toggleMute() {
    audioPlayer.muted = !audioPlayer.muted;
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const btn = document.getElementById('playerMuteBtn');
    if (audioPlayer.muted || audioPlayer.volume === 0) {
        btn.textContent = '🔇';
    } else if (audioPlayer.volume < 0.5) {
        btn.textContent = '🔉';
    } else {
        btn.textContent = '🔊';
    }
}

function highlightCurrentTrack(filename) {
    // Remove destaque anterior
    document.querySelectorAll('.playing-row').forEach(el => el.classList.remove('playing-row'));

    // Adiciona destaque na linha atual
    document.querySelectorAll(`[data-filename="${filename}"]`).forEach(el => {
        const row = el.closest('tr');
        if (row) row.classList.add('playing-row');
    });
}

// ============================================
// Cookies Management
// ============================================
const COOKIES_STORAGE_KEY = 'yt_cookies';

function getSavedCookies() {
    return localStorage.getItem(COOKIES_STORAGE_KEY) || '';
}

function saveCookies(cookies) {
    if (cookies) {
        localStorage.setItem(COOKIES_STORAGE_KEY, cookies);
    } else {
        localStorage.removeItem(COOKIES_STORAGE_KEY);
    }
    updateCookiesIcon();
}

function updateCookiesIcon() {
    const icons = document.querySelectorAll('#cookiesIcon');
    const hasCookies = !!getSavedCookies();
    icons.forEach(icon => {
        icon.textContent = hasCookies ? '🔒' : '🔓';
    });
}

// ============================================
// Navigation
// ============================================
const sections = {
    download: { title: 'Novo Download', subtitle: 'Baixe videos e playlists do YouTube em MP3' },
    queue: { title: 'Fila de Downloads', subtitle: 'Gerencie seus downloads em lote' },
    library: { title: 'Biblioteca', subtitle: 'Seus arquivos baixados' },
    settings: { title: 'Configuracoes', subtitle: 'Ajustes do aplicativo' }
};

function navigateTo(sectionName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionName);
    });

    // Update sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${sectionName}Section`).classList.add('active');

    // Update header
    const section = sections[sectionName];
    document.getElementById('pageTitle').textContent = section.title;
    document.getElementById('pageSubtitle').textContent = section.subtitle;

    // Load section data
    if (sectionName === 'queue') loadQueue();
    if (sectionName === 'library') loadLibrary();
    if (sectionName === 'settings') loadSettingsCookies();
}

// ============================================
// Utility Functions
// ============================================
function formatDuration(seconds) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.classList.remove('hidden');
}

function hideError(elementId) {
    document.getElementById(elementId).classList.add('hidden');
}

function setLoading(btn, loading) {
    const textEl = btn.querySelector('.btn-text');
    const loaderEl = btn.querySelector('.btn-loader');
    if (textEl) textEl.classList.toggle('hidden', loading);
    if (loaderEl) loaderEl.classList.toggle('hidden', !loading);
    btn.disabled = loading;
}

// ============================================
// Download Section
// ============================================
let currentTaskId = null;
let currentDownloadType = null;
let currentUrl = null;
let progressInterval = null;

async function fetchVideoInfo() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) return;

    currentUrl = url;
    const fetchBtn = document.getElementById('fetchBtn');
    setLoading(fetchBtn, true);
    hideError('errorMessage');
    hideAllCards();

    try {
        const response = await fetch(`${API_BASE}/api/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, cookies: getSavedCookies() })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao buscar informacoes');
        }

        if (data.type === 'playlist') {
            showPlaylistInfo(data);
        } else {
            showVideoInfo(data);
        }
    } catch (error) {
        showError('errorMessage', error.message);
    } finally {
        setLoading(fetchBtn, false);
    }
}

function hideAllCards() {
    ['videoInfoCard', 'playlistInfoCard', 'progressCard', 'completeCard'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
}

function showVideoInfo(data) {
    document.getElementById('thumbnail').src = data.thumbnail || '';
    document.getElementById('videoTitle').textContent = data.title;
    document.getElementById('videoChannel').textContent = data.channel || '';
    document.getElementById('videoDuration').textContent = `Duracao: ${formatDuration(data.duration)}`;
    document.getElementById('videoInfoCard').classList.remove('hidden');
    currentDownloadType = 'video';
}

function showPlaylistInfo(data) {
    document.getElementById('playlistTitle').textContent = data.title;
    document.getElementById('playlistCount').textContent = `${data.count} videos`;

    const tbody = document.getElementById('playlistVideos');
    tbody.innerHTML = data.videos.map((video, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${video.title}</td>
            <td>${formatDuration(video.duration)}</td>
        </tr>
    `).join('');

    document.getElementById('playlistInfoCard').classList.remove('hidden');
    currentDownloadType = 'playlist';
}

async function startDownload() {
    hideAllCards();
    document.getElementById('progressCard').classList.remove('hidden');
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressStatus').textContent = 'Iniciando download...';

    try {
        const response = await fetch(`${API_BASE}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: currentUrl,
                type: currentDownloadType,
                cookies: getSavedCookies()
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao iniciar download');
        }

        currentTaskId = data.task_id;
        startProgressPolling();
    } catch (error) {
        showError('errorMessage', error.message);
        hideAllCards();
    }
}

function startProgressPolling() {
    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/progress/${currentTaskId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao obter progresso');
            }

            updateProgress(data);

            if (data.status === 'completed') {
                clearInterval(progressInterval);
                showComplete(data);
            } else if (data.status === 'error') {
                clearInterval(progressInterval);
                showError('errorMessage', data.error || 'Erro no download');
                hideAllCards();
            }
        } catch (error) {
            console.error('Progress error:', error);
        }
    }, 1000);
}

function updateProgress(data) {
    const progress = Math.round(data.progress || 0);
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressPercent').textContent = `${progress}%`;

    let status = 'Baixando...';
    if (data.status === 'converting') {
        status = 'Convertendo para MP3...';
    } else if (data.current_video) {
        status = `Baixando: ${data.current_video} (${data.current_index}/${data.total})`;
    }
    document.getElementById('progressStatus').textContent = status;
}

function showComplete(data) {
    document.getElementById('progressCard').classList.add('hidden');
    document.getElementById('completeCard').classList.remove('hidden');

    if (currentDownloadType === 'playlist') {
        const completed = data.videos ? data.videos.filter(v => v.status === 'completed').length : 0;
        document.getElementById('completeMessage').textContent = `${completed} arquivos baixados com sucesso!`;
        document.getElementById('saveFileBtn').textContent = 'Baixar ZIP';
    } else {
        document.getElementById('completeMessage').textContent = data.filename || 'Arquivo baixado com sucesso!';
        document.getElementById('saveFileBtn').textContent = 'Salvar Arquivo';
    }
}

function downloadFile() {
    if (currentDownloadType === 'playlist') {
        window.location.href = `${API_BASE}/api/download-zip/${currentTaskId}`;
    } else {
        window.location.href = `${API_BASE}/api/download-file/${currentTaskId}`;
    }
}

function resetDownload() {
    hideAllCards();
    document.getElementById('urlInput').value = '';
    currentTaskId = null;
    currentDownloadType = null;
    currentUrl = null;
}

async function addCurrentToQueue() {
    if (!currentUrl) return;

    try {
        const response = await fetch(`${API_BASE}/api/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: [currentUrl], cookies: getSavedCookies() })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao adicionar a fila');
        }

        // Show success and reset
        alert('Adicionado a fila! Veja na secao "Fila de Downloads".');
        resetDownload();
        loadQueue(); // Update queue badge
    } catch (error) {
        showError('errorMessage', error.message);
    }
}

// ============================================
// Queue Section
// ============================================
let queueInterval = null;

function countUrls(text) {
    const urls = text.split('\n').filter(line => line.trim().length > 0);
    return urls.length;
}

async function addToQueue() {
    const textarea = document.getElementById('batchUrls');
    const urls = textarea.value.split('\n').filter(line => line.trim().length > 0);

    if (urls.length === 0) return;

    const btn = document.getElementById('addToQueueBtn');
    setLoading(btn, true);
    hideError('batchError');

    try {
        const response = await fetch(`${API_BASE}/api/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, cookies: getSavedCookies() })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao adicionar a fila');
        }

        textarea.value = '';
        document.getElementById('urlCount').textContent = '0 URLs detectadas';
        loadQueue();
    } catch (error) {
        showError('batchError', error.message);
    } finally {
        setLoading(btn, false);
    }
}

async function loadQueue() {
    try {
        const response = await fetch(`${API_BASE}/api/queue`);
        const data = await response.json();

        updateQueueStats(data.items);
        updateQueueTable(data.items);
        updateQueueBadge(data.items);

        // Start polling if there are active items (mais frequente durante processamento)
        const hasProcessing = data.items.some(item => item.status === 'processing');
        const hasQueued = data.items.some(item => item.status === 'queued');

        if (hasProcessing) {
            // Polling rápido durante download
            if (queueInterval) clearInterval(queueInterval);
            queueInterval = setInterval(loadQueue, 1000);
        } else if (hasQueued) {
            // Polling mais lento quando só tem itens na fila
            if (queueInterval) clearInterval(queueInterval);
            queueInterval = setInterval(loadQueue, 3000);
        } else if (queueInterval) {
            // Para o polling quando não tem mais itens ativos
            clearInterval(queueInterval);
            queueInterval = null;
        }
    } catch (error) {
        console.error('Queue error:', error);
    }
}

function updateQueueStats(items) {
    const stats = {
        pending: items.filter(i => i.status === 'queued').length,
        processing: items.filter(i => i.status === 'processing').length,
        completed: items.filter(i => i.status === 'completed').length,
        errors: items.filter(i => i.status === 'error').length
    };

    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statProcessing').textContent = stats.processing;
    document.getElementById('statCompleted').textContent = stats.completed;
    document.getElementById('statErrors').textContent = stats.errors;
}

function updateQueueTable(items) {
    const tbody = document.getElementById('queueTableBody');

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum item na fila</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        let progressHtml = '';
        let statusText = '';

        switch (item.status) {
            case 'processing':
                const percent = Math.round(item.progress || 0);
                let progressDetail = `${percent}%`;
                if (item.current_video && item.total) {
                    progressDetail = `${item.current_index}/${item.total} - ${percent}%`;
                }
                progressHtml = `
                    <div class="queue-progress">
                        <div class="progress-bar-container" style="height: 6px; margin-bottom: 4px;">
                            <div class="progress-bar" style="width: ${percent}%"></div>
                        </div>
                        <small class="progress-detail">${progressDetail}</small>
                        ${item.current_video ? `<small class="current-video" title="${item.current_video}">♫ ${truncateText(item.current_video, 30)}</small>` : ''}
                    </div>`;
                statusText = 'Baixando';
                break;
            case 'queued':
                progressHtml = '<small class="text-muted">Aguardando...</small>';
                statusText = 'Na fila';
                break;
            case 'completed':
                progressHtml = '<small class="text-success">✓ Concluído</small>';
                statusText = 'Completo';
                break;
            case 'error':
                progressHtml = `<small class="text-danger" title="${item.error || 'Erro desconhecido'}">✗ Erro</small>`;
                statusText = 'Erro';
                break;
            case 'cancelled':
                progressHtml = '<small class="text-muted">Cancelado</small>';
                statusText = 'Cancelado';
                break;
            default:
                progressHtml = `<small>${item.status}</small>`;
                statusText = item.status;
        }

        // Botões de ação baseados no status
        let actionsHtml = '';
        if (item.status === 'queued') {
            actionsHtml = `<button class="btn btn-sm btn-danger" onclick="removeFromQueue('${item.task_id}')" title="Remover da fila">✗</button>`;
        } else if (item.status === 'processing') {
            actionsHtml = `<button class="btn btn-sm btn-outline" disabled title="Em andamento...">⏳</button>`;
        } else if (item.status === 'completed') {
            if (item.type === 'video') {
                // Para vídeos únicos, mostrar botão de play
                actionsHtml = `
                    <button class="btn btn-sm btn-play" onclick="playQueueItem('${item.task_id}')" title="Tocar">▶</button>
                    <button class="btn btn-sm btn-primary" onclick="downloadQueueItem('${item.task_id}', '${item.type}')" title="Baixar">⬇</button>`;
            } else {
                // Para playlists, só download
                actionsHtml = `<button class="btn btn-sm btn-primary" onclick="downloadQueueItem('${item.task_id}', '${item.type}')" title="Baixar ZIP">⬇</button>`;
            }
        } else {
            actionsHtml = `<button class="btn btn-sm btn-outline" onclick="removeFromQueue('${item.task_id}')" title="Remover">🗑</button>`;
        }

        return `
            <tr class="queue-item queue-item-${item.status}" data-task-id="${item.task_id}">
                <td><span class="status-dot ${item.status}" title="${statusText}"></span></td>
                <td class="queue-title" title="${item.title}">${truncateText(item.title, 50)}</td>
                <td><span class="badge badge-${item.type === 'playlist' ? 'info' : 'success'}">${item.type === 'playlist' ? 'Lista' : 'Música'}</span></td>
                <td>${progressHtml}</td>
                <td class="table-actions">${actionsHtml}</td>
            </tr>
        `;
    }).join('');
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

async function removeFromQueue(taskId) {
    try {
        const response = await fetch(`${API_BASE}/api/queue/${taskId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Erro ao remover item');
            return;
        }

        // Atualiza a fila
        loadQueue();
    } catch (error) {
        console.error('Remove from queue error:', error);
        alert('Erro ao remover item da fila');
    }
}

async function downloadQueueItem(taskId, itemType) {
    if (itemType === 'playlist') {
        window.location.href = `${API_BASE}/api/download-zip/${taskId}`;
    } else {
        window.location.href = `${API_BASE}/api/download-file/${taskId}`;
    }
}

async function playQueueItem(taskId) {
    try {
        // Busca o progresso para obter o nome do arquivo
        const response = await fetch(`${API_BASE}/api/progress/${taskId}`);
        const data = await response.json();

        if (data.filename) {
            playTrack(data.filename, libraryFiles);
        } else {
            console.error('Arquivo não encontrado para esta tarefa');
        }
    } catch (error) {
        console.error('Erro ao reproduzir item da fila:', error);
    }
}

function updateQueueBadge(items) {
    const active = items.filter(i => ['queued', 'processing'].includes(i.status)).length;
    const badge = document.getElementById('queueBadge');
    badge.textContent = active;
    badge.style.display = active > 0 ? 'block' : 'none';
}

async function clearQueue() {
    try {
        await fetch(`${API_BASE}/api/queue/clear`, { method: 'POST' });
        loadQueue();
    } catch (error) {
        console.error('Clear queue error:', error);
    }
}

// ============================================
// Library Section
// ============================================
let selectedFiles = new Set();
let libraryFiles = []; // Lista de arquivos para o player

async function loadLibrary() {
    try {
        const response = await fetch(`${API_BASE}/api/list-downloads`);
        const files = await response.json();

        document.getElementById('totalFiles').textContent = files.length;

        // Sort by modified date (newest first)
        files.sort((a, b) => b.modified - a.modified);

        // Salva a lista para o player
        libraryFiles = files.map(f => f.name);

        updateLibraryTable(files);
    } catch (error) {
        console.error('Library error:', error);
    }
}

function updateLibraryTable(files) {
    const tbody = document.getElementById('libraryTableBody');

    if (files.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum arquivo baixado</td></tr>';
        libraryFiles = [];
        return;
    }

    tbody.innerHTML = files.map(file => {
        const escapedName = file.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');

        // Título: usa tag ID3 ou nome do arquivo sem extensão
        const displayTitle = file.title || file.name.replace(/\.mp3$/i, '');

        // Artista e informações adicionais
        let artistInfo = file.artist || '';
        let extraInfo = [];
        if (file.album) extraInfo.push(file.album);
        if (file.year) extraInfo.push(file.year);
        if (file.genre) extraInfo.push(file.genre);

        // Duração formatada
        const durationStr = file.duration ? formatDuration(file.duration) : '--:--';

        // Tooltip com todas as informações
        let tooltipParts = [file.name];
        if (file.title) tooltipParts.push(`Título: ${file.title}`);
        if (file.artist) tooltipParts.push(`Artista: ${file.artist}`);
        if (file.album) tooltipParts.push(`Álbum: ${file.album}`);
        if (file.year) tooltipParts.push(`Ano: ${file.year}`);
        if (file.genre) tooltipParts.push(`Gênero: ${file.genre}`);
        const tooltip = tooltipParts.join('\n');

        return `
        <tr data-filename="${file.name}">
            <td><input type="checkbox" class="file-checkbox" data-filename="${file.name}"></td>
            <td class="library-title-cell" title="${tooltip}">
                <div class="library-title">${truncateText(displayTitle, 45)}</div>
                ${extraInfo.length > 0 ? `<div class="library-extra">${truncateText(extraInfo.join(' • '), 50)}</div>` : ''}
            </td>
            <td class="library-artist">${truncateText(artistInfo, 25) || '<span class="text-muted">-</span>'}</td>
            <td class="library-duration">${durationStr}</td>
            <td class="library-size">${formatFileSize(file.size)}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-play" onclick="playFromLibrary('${escapedName}')" title="Tocar">▶</button>
                <button class="btn btn-sm btn-primary" onclick="downloadExisting('${escapedName}')" title="Baixar">⬇</button>
                <button class="btn btn-sm btn-danger" onclick="deleteFile('${escapedName}')" title="Deletar">🗑</button>
            </td>
        </tr>
    `}).join('');

    // Add checkbox listeners
    document.querySelectorAll('.file-checkbox').forEach(cb => {
        cb.addEventListener('change', updateSelectedFiles);
    });
}

function playFromLibrary(filename) {
    // Toca a música passando a playlist completa da biblioteca
    playTrack(filename, libraryFiles);
}

function updateSelectedFiles() {
    selectedFiles.clear();
    document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
        selectedFiles.add(cb.dataset.filename);
    });

    const hasSelected = selectedFiles.size > 0;
    document.getElementById('downloadSelectedBtn').disabled = !hasSelected;
    document.getElementById('deleteSelectedBtn').disabled = !hasSelected;
}

function downloadExisting(filename) {
    window.location.href = `${API_BASE}/api/download-existing/${encodeURIComponent(filename)}`;
}

async function deleteFile(filename) {
    if (!confirm(`Deletar "${filename}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/api/delete-file/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadLibrary();
        }
    } catch (error) {
        console.error('Delete error:', error);
    }
}

async function downloadSelectedFiles() {
    if (selectedFiles.size === 0) return;

    try {
        const response = await fetch(`${API_BASE}/api/download-multiple`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: Array.from(selectedFiles) })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'downloads.zip';
            a.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Download multiple error:', error);
    }
}

async function deleteSelectedFiles() {
    if (selectedFiles.size === 0) return;
    if (!confirm(`Deletar ${selectedFiles.size} arquivos?`)) return;

    for (const filename of selectedFiles) {
        try {
            await fetch(`${API_BASE}/api/delete-file/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Delete error:', error);
        }
    }

    selectedFiles.clear();
    loadLibrary();
}

// ============================================
// Settings Section
// ============================================
function loadSettingsCookies() {
    document.getElementById('settingsCookiesInput').value = getSavedCookies();
}

function saveSettingsCookies() {
    const cookies = document.getElementById('settingsCookiesInput').value.trim();
    saveCookies(cookies);
    showStatus('settingsCookiesStatus', cookies ? 'Cookies salvos!' : 'Cookies removidos');
}

function clearSettingsCookies() {
    document.getElementById('settingsCookiesInput').value = '';
    saveCookies('');
    showStatus('settingsCookiesStatus', 'Cookies removidos');
}

function showStatus(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    setTimeout(() => { el.textContent = ''; }, 3000);
}

// ============================================
// Cookies Panel
// ============================================
function toggleCookiesPanel() {
    const panel = document.getElementById('cookiesPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        document.getElementById('cookiesInput').value = getSavedCookies();
    }
}

function savePanelCookies() {
    const cookies = document.getElementById('cookiesInput').value.trim();
    saveCookies(cookies);
    showStatus('cookiesStatus', cookies ? 'Salvos!' : 'Removidos');
}

function clearPanelCookies() {
    document.getElementById('cookiesInput').value = '';
    saveCookies('');
    showStatus('cookiesStatus', 'Removidos');
}

// ============================================
// Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.section);
        });
    });

    // Download section
    document.getElementById('fetchBtn').addEventListener('click', fetchVideoInfo);
    document.getElementById('urlInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchVideoInfo();
    });
    document.getElementById('downloadBtn').addEventListener('click', startDownload);
    document.getElementById('downloadPlaylistBtn').addEventListener('click', startDownload);
    document.getElementById('addVideoToQueueBtn').addEventListener('click', addCurrentToQueue);
    document.getElementById('addPlaylistToQueueBtn').addEventListener('click', addCurrentToQueue);
    document.getElementById('saveFileBtn').addEventListener('click', downloadFile);
    document.getElementById('newDownloadBtn').addEventListener('click', resetDownload);

    // Queue section
    document.getElementById('batchUrls').addEventListener('input', (e) => {
        const count = countUrls(e.target.value);
        document.getElementById('urlCount').textContent = `${count} URLs detectadas`;
    });
    document.getElementById('addToQueueBtn').addEventListener('click', addToQueue);
    document.getElementById('refreshQueueBtn').addEventListener('click', loadQueue);
    document.getElementById('clearQueueBtn').addEventListener('click', clearQueue);

    // Library section
    document.getElementById('selectAllFiles').addEventListener('change', (e) => {
        document.querySelectorAll('.file-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
        });
        updateSelectedFiles();
    });
    document.getElementById('downloadSelectedBtn').addEventListener('click', downloadSelectedFiles);
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedFiles);

    // Settings section
    document.getElementById('settingsSaveCookiesBtn').addEventListener('click', saveSettingsCookies);
    document.getElementById('settingsClearCookiesBtn').addEventListener('click', clearSettingsCookies);

    // Cookies panel
    document.getElementById('toggleCookiesBtn').addEventListener('click', toggleCookiesPanel);
    document.getElementById('closeCookiesPanel').addEventListener('click', toggleCookiesPanel);
    document.getElementById('saveCookiesBtn').addEventListener('click', savePanelCookies);
    document.getElementById('clearCookiesBtn').addEventListener('click', clearPanelCookies);

    // Library section - Play all button
    document.getElementById('playAllBtn').addEventListener('click', () => {
        if (libraryFiles.length > 0) {
            playTrack(libraryFiles[0], libraryFiles);
        }
    });

    // Initialize
    initAudioPlayer();
    updateCookiesIcon();
    loadLibrary();
    loadQueue();
});
