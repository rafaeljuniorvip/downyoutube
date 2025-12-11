const API_BASE = '';

// ============ Cookies Management ============
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
    const icon = document.getElementById('cookiesIcon');
    const hasCookies = !!getSavedCookies();
    icon.textContent = hasCookies ? '🔒' : '🔓';
}

// Initialize cookies UI
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleCookies');
    const cookiesConfig = document.getElementById('cookiesConfig');
    const cookiesInput = document.getElementById('cookiesInput');
    const saveCookiesBtn = document.getElementById('saveCookiesBtn');
    const clearCookiesBtn = document.getElementById('clearCookiesBtn');
    const cookiesStatus = document.getElementById('cookiesStatus');

    // Load saved cookies
    cookiesInput.value = getSavedCookies();
    updateCookiesIcon();

    // Toggle panel
    toggleBtn.addEventListener('click', () => {
        cookiesConfig.classList.toggle('hidden');
    });

    // Save cookies
    saveCookiesBtn.addEventListener('click', () => {
        const cookies = cookiesInput.value.trim();
        saveCookies(cookies);
        cookiesStatus.textContent = cookies ? 'Cookies salvos!' : 'Cookies removidos';
        cookiesStatus.className = 'cookies-status success';
        setTimeout(() => {
            cookiesStatus.textContent = '';
        }, 3000);
    });

    // Clear cookies
    clearCookiesBtn.addEventListener('click', () => {
        cookiesInput.value = '';
        saveCookies('');
        cookiesStatus.textContent = 'Cookies removidos';
        cookiesStatus.className = 'cookies-status';
        setTimeout(() => {
            cookiesStatus.textContent = '';
        }, 3000);
    });
});

// Elementos do DOM - Single
const urlInput = document.getElementById('urlInput');
const fetchBtn = document.getElementById('fetchBtn');
const errorMessage = document.getElementById('errorMessage');
const videoInfo = document.getElementById('videoInfo');
const playlistInfo = document.getElementById('playlistInfo');
const progressSection = document.getElementById('progressSection');
const downloadComplete = document.getElementById('downloadComplete');
const downloadsList = document.getElementById('downloadsList');

// Elementos do DOM - Batch
const batchUrls = document.getElementById('batchUrls');
const urlCount = document.getElementById('urlCount');
const addToQueueBtn = document.getElementById('addToQueueBtn');
const batchError = document.getElementById('batchError');
const queueList = document.getElementById('queueList');
const refreshQueueBtn = document.getElementById('refreshQueueBtn');
const clearQueueBtn = document.getElementById('clearQueueBtn');

// Estado atual
let currentTaskId = null;
let currentType = null;
let progressInterval = null;
let queueInterval = null;

// Event Listeners - Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        // Start/stop queue polling based on tab
        if (tabName === 'batch') {
            startQueuePolling();
        } else {
            stopQueuePolling();
        }
    });
});

// Event Listeners - Single Download
fetchBtn.addEventListener('click', fetchInfo);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchInfo();
});

document.getElementById('downloadBtn').addEventListener('click', () => startDownload('video'));
document.getElementById('downloadPlaylistBtn').addEventListener('click', () => startDownload('playlist'));
document.getElementById('saveFileBtn').addEventListener('click', saveFile);
document.getElementById('newDownloadBtn').addEventListener('click', resetUI);

// Event Listeners - Batch
batchUrls.addEventListener('input', updateUrlCount);
addToQueueBtn.addEventListener('click', addToQueue);
refreshQueueBtn.addEventListener('click', loadQueue);
clearQueueBtn.addEventListener('click', clearFinished);

// Carrega downloads anteriores ao iniciar
loadPreviousDownloads();

// ============ Single Download Functions ============

async function fetchInfo() {
    const url = urlInput.value.trim();

    if (!url) {
        showError('Por favor, insira uma URL do YouTube');
        return;
    }

    if (!isValidYouTubeUrl(url)) {
        showError('URL invalida. Use uma URL do YouTube valida.');
        return;
    }

    hideAllSections();
    setLoading(true);

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
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

function isValidYouTubeUrl(url) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
        /^(https?:\/\/)?youtu\.be\/[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

function showVideoInfo(data) {
    document.getElementById('thumbnail').src = data.thumbnail || 'https://via.placeholder.com/200x112?text=No+Thumbnail';
    document.getElementById('videoTitle').textContent = data.title;
    document.getElementById('videoChannel').textContent = data.channel;
    document.getElementById('videoDuration').textContent = formatDuration(data.duration);

    videoInfo.classList.remove('hidden');
    currentType = 'video';
}

function showPlaylistInfo(data) {
    document.getElementById('playlistTitle').textContent = data.title;
    document.getElementById('playlistCount').textContent = `${data.count} videos`;

    const videosContainer = document.getElementById('playlistVideos');
    videosContainer.innerHTML = data.videos.map((video, index) => `
        <div class="playlist-item">
            <span class="playlist-item-number">${index + 1}</span>
            <span class="playlist-item-title">${escapeHtml(video.title)}</span>
            <span class="playlist-item-duration">${formatDuration(video.duration)}</span>
        </div>
    `).join('');

    playlistInfo.classList.remove('hidden');
    currentType = 'playlist';
}

async function startDownload(type) {
    const url = urlInput.value.trim();

    hideAllSections();
    progressSection.classList.remove('hidden');

    document.getElementById('progressTitle').textContent =
        type === 'playlist' ? 'Baixando playlist...' : 'Baixando...';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    document.getElementById('progressStatus').textContent = 'Iniciando...';

    try {
        const response = await fetch(`${API_BASE}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, type, cookies: getSavedCookies() })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao iniciar download');
        }

        currentTaskId = data.task_id;
        currentType = type;
        startProgressPolling();

    } catch (error) {
        showError(error.message);
        progressSection.classList.add('hidden');
    }
}

function startProgressPolling() {
    progressInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/progress/${currentTaskId}`);
            const data = await response.json();

            updateProgress(data);

            if (data.status === 'completed') {
                clearInterval(progressInterval);
                showDownloadComplete(data);
            } else if (data.status === 'error') {
                clearInterval(progressInterval);
                showError(data.error || 'Erro durante o download');
                progressSection.classList.add('hidden');
            }

        } catch (error) {
            console.error('Erro ao verificar progresso:', error);
        }
    }, 500);
}

function updateProgress(data) {
    const progress = Math.round(data.progress || 0);
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `${progress}%`;

    let statusText = '';

    if (data.type === 'playlist' && data.current_video) {
        statusText = `Baixando: ${data.current_video} (${data.current_index}/${data.total})`;
    } else if (data.status === 'downloading') {
        statusText = 'Baixando audio...';
    } else if (data.status === 'converting') {
        statusText = 'Convertendo para MP3...';
    } else if (data.status === 'starting') {
        statusText = 'Iniciando...';
    }

    document.getElementById('progressStatus').textContent = statusText;
}

function showDownloadComplete(data) {
    progressSection.classList.add('hidden');
    downloadComplete.classList.remove('hidden');

    if (data.type === 'playlist') {
        const completed = data.videos?.filter(v => v.status === 'completed').length || 0;
        document.getElementById('completedFilename').textContent =
            `${completed} arquivos baixados com sucesso!`;
    } else {
        document.getElementById('completedFilename').textContent = data.filename || 'Arquivo baixado';
    }

    loadPreviousDownloads();
}

async function saveFile() {
    if (!currentTaskId || currentType === 'playlist') {
        loadPreviousDownloads();
        return;
    }

    window.location.href = `${API_BASE}/api/download-file/${currentTaskId}`;
}

function resetUI() {
    urlInput.value = '';
    hideAllSections();
    currentTaskId = null;
    currentType = null;
    if (progressInterval) {
        clearInterval(progressInterval);
    }
}

function hideAllSections() {
    errorMessage.classList.add('hidden');
    videoInfo.classList.add('hidden');
    playlistInfo.classList.add('hidden');
    progressSection.classList.add('hidden');
    downloadComplete.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function setLoading(loading) {
    fetchBtn.disabled = loading;
    document.querySelector('#fetchBtn .btn-text').classList.toggle('hidden', loading);
    document.querySelector('#fetchBtn .btn-loader').classList.toggle('hidden', !loading);
}

// ============ Batch Functions ============

function updateUrlCount() {
    const urls = parseUrls(batchUrls.value);
    urlCount.textContent = `${urls.length} URL${urls.length !== 1 ? 's' : ''} detectada${urls.length !== 1 ? 's' : ''}`;
}

function parseUrls(text) {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && isValidYouTubeUrl(line));
}

async function addToQueue() {
    const urls = parseUrls(batchUrls.value);

    if (urls.length === 0) {
        batchError.textContent = 'Nenhuma URL valida encontrada';
        batchError.classList.remove('hidden');
        return;
    }

    batchError.classList.add('hidden');
    setBatchLoading(true);

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

        batchUrls.value = '';
        updateUrlCount();
        loadQueue();
        startQueuePolling();

    } catch (error) {
        batchError.textContent = error.message;
        batchError.classList.remove('hidden');
    } finally {
        setBatchLoading(false);
    }
}

function setBatchLoading(loading) {
    addToQueueBtn.disabled = loading;
    document.querySelector('#addToQueueBtn .btn-text').classList.toggle('hidden', loading);
    document.querySelector('#addToQueueBtn .btn-loader').classList.toggle('hidden', !loading);
}

async function loadQueue() {
    try {
        const response = await fetch(`${API_BASE}/api/queue`);
        const data = await response.json();

        updateQueueStats(data.items);
        renderQueueList(data.items);
        loadPreviousDownloads();

    } catch (error) {
        console.error('Erro ao carregar fila:', error);
    }
}

function updateQueueStats(items) {
    const stats = {
        queued: 0,
        processing: 0,
        completed: 0,
        error: 0
    };

    items.forEach(item => {
        if (stats.hasOwnProperty(item.status)) {
            stats[item.status]++;
        }
    });

    document.getElementById('queuePending').textContent = stats.queued;
    document.getElementById('queueProcessing').textContent = stats.processing;
    document.getElementById('queueCompleted').textContent = stats.completed;
    document.getElementById('queueErrors').textContent = stats.error;
}

function renderQueueList(items) {
    if (items.length === 0) {
        queueList.innerHTML = '<p class="no-items">Nenhum item na fila</p>';
        return;
    }

    queueList.innerHTML = items.map(item => {
        const progress = Math.round(item.progress || 0);
        const statusClass = item.status;

        let progressHtml = '';
        if (item.status === 'processing') {
            let progressText = `${progress}%`;
            if (item.type === 'playlist' && item.current_index && item.total) {
                progressText = `${item.current_index}/${item.total}`;
            }
            progressHtml = `
                <div class="queue-item-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="queue-item-progress-text">${progressText}</div>
                </div>
            `;
        }

        let errorHtml = '';
        if (item.status === 'error' && item.error) {
            errorHtml = `<div class="queue-item-error">${escapeHtml(item.error)}</div>`;
        }

        return `
            <div class="queue-item">
                <div class="queue-item-status ${statusClass}"></div>
                <div class="queue-item-info">
                    <div class="queue-item-title">${escapeHtml(item.title)}</div>
                    <div class="queue-item-meta">
                        <span class="queue-item-type">${item.type}</span>
                        <span>${getStatusText(item.status)}</span>
                    </div>
                    ${errorHtml}
                </div>
                ${progressHtml}
            </div>
        `;
    }).join('');
}

function getStatusText(status) {
    const texts = {
        'queued': 'Na fila',
        'processing': 'Processando',
        'completed': 'Completo',
        'error': 'Erro',
        'cancelled': 'Cancelado'
    };
    return texts[status] || status;
}

async function clearFinished() {
    try {
        await fetch(`${API_BASE}/api/queue/clear`, { method: 'POST' });
        loadQueue();
    } catch (error) {
        console.error('Erro ao limpar fila:', error);
    }
}

function startQueuePolling() {
    if (queueInterval) return;

    loadQueue();
    queueInterval = setInterval(loadQueue, 2000);
}

function stopQueuePolling() {
    if (queueInterval) {
        clearInterval(queueInterval);
        queueInterval = null;
    }
}

// ============ Utility Functions ============

function formatDuration(seconds) {
    if (!seconds) return '--:--';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadPreviousDownloads() {
    try {
        const response = await fetch(`${API_BASE}/api/list-downloads`);
        const files = await response.json();

        if (files.length === 0) {
            downloadsList.innerHTML = '<p class="no-downloads">Nenhum download ainda</p>';
            return;
        }

        // Ordena por data de modificacao (mais recente primeiro)
        files.sort((a, b) => b.modified - a.modified);

        downloadsList.innerHTML = files.map(file => `
            <div class="download-item">
                <div class="download-item-info">
                    <div class="download-item-name">${escapeHtml(file.name)}</div>
                    <div class="download-item-size">${formatFileSize(file.size)}</div>
                </div>
                <button class="btn btn-primary" onclick="downloadExisting('${escapeHtml(file.name)}')">
                    Baixar
                </button>
            </div>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar downloads:', error);
    }
}

function downloadExisting(filename) {
    window.location.href = `${API_BASE}/api/download-existing/${encodeURIComponent(filename)}`;
}
