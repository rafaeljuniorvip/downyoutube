from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import re
import threading
import uuid
import tempfile
from pathlib import Path
from queue import Queue
from datetime import datetime

app = Flask(__name__)
CORS(app)

DOWNLOAD_FOLDER = Path("downloads")
DOWNLOAD_FOLDER.mkdir(exist_ok=True)

# Armazena cookies por sessão/task
task_cookies = {}


def create_temp_cookies_file(cookies_content):
    """Cria um arquivo temporário com os cookies"""
    if not cookies_content:
        return None
    fd, path = tempfile.mkstemp(suffix='.txt', prefix='cookies_')
    with os.fdopen(fd, 'w') as f:
        f.write(cookies_content)
    return path


def cleanup_cookies_file(path):
    """Remove o arquivo temporário de cookies"""
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except:
            pass


def get_cookies_opts(cookies_content=None):
    """Retorna opções de cookies"""
    if cookies_content:
        cookies_file = create_temp_cookies_file(cookies_content)
        if cookies_file:
            return {'cookiefile': cookies_file}
    return {}

# Armazena o progresso dos downloads
download_progress = {}

# Sistema de fila batch
download_queue = Queue()
queue_items = {}  # Armazena informações dos itens na fila
queue_lock = threading.Lock()
worker_thread = None
worker_running = False


def sanitize_filename(filename):
    """Remove caracteres inválidos do nome do arquivo"""
    return re.sub(r'[<>:"/\\|?*]', '', filename)


def progress_hook(d, task_id):
    """Hook para atualizar o progresso do download"""
    if task_id not in download_progress:
        return
    if d['status'] == 'downloading':
        total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
        downloaded = d.get('downloaded_bytes', 0)
        if total > 0:
            percent = (downloaded / total) * 100
            download_progress[task_id]['progress'] = percent
            download_progress[task_id]['status'] = 'downloading'
    elif d['status'] == 'finished':
        download_progress[task_id]['status'] = 'converting'


def get_video_info(url, cookies=None):
    """Obtém informações do vídeo ou playlist"""
    cookies_opts = get_cookies_opts(cookies)
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist',
        **cookies_opts,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info
    finally:
        cleanup_cookies_file(cookies_opts.get('cookiefile'))


def download_single_video(url, task_id, output_path=None, cookies=None):
    """Baixa um único vídeo como MP3"""
    # Busca cookies da tarefa se não fornecidos
    if cookies is None:
        cookies = task_cookies.get(task_id) or task_cookies.get(task_id.split('_video_')[0])

    cookies_opts = get_cookies_opts(cookies)

    try:
        if output_path is None:
            output_path = str(DOWNLOAD_FOLDER)

        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
            'progress_hooks': [lambda d: progress_hook(d, task_id)],
            'quiet': True,
            'no_warnings': True,
            **cookies_opts,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = sanitize_filename(info['title']) + '.mp3'
            filepath = os.path.join(output_path, filename)

            download_progress[task_id]['status'] = 'completed'
            download_progress[task_id]['progress'] = 100
            download_progress[task_id]['filename'] = filename
            download_progress[task_id]['filepath'] = filepath

            return filepath

    except Exception as e:
        download_progress[task_id]['status'] = 'error'
        download_progress[task_id]['error'] = str(e)
        return None
    finally:
        cleanup_cookies_file(cookies_opts.get('cookiefile'))


def download_playlist(url, task_id):
    """Baixa todos os vídeos de uma playlist como MP3"""
    cookies = task_cookies.get(task_id)

    try:
        # Primeiro, obtém a lista de vídeos
        info = get_video_info(url, cookies)

        if 'entries' not in info:
            download_progress[task_id]['status'] = 'error'
            download_progress[task_id]['error'] = 'URL não é uma playlist válida'
            return

        entries = list(info['entries'])
        total_videos = len(entries)
        download_progress[task_id]['total'] = total_videos
        download_progress[task_id]['completed_count'] = 0
        download_progress[task_id]['videos'] = []

        for i, entry in enumerate(entries):
            if entry is None:
                continue

            video_url = f"https://www.youtube.com/watch?v={entry['id']}"
            video_title = entry.get('title', f'Video {i+1}')

            download_progress[task_id]['current_video'] = video_title
            download_progress[task_id]['current_index'] = i + 1

            # Cria um sub-task para cada vídeo
            sub_task_id = f"{task_id}_video_{i}"
            download_progress[sub_task_id] = {
                'status': 'starting',
                'progress': 0,
            }

            filepath = download_single_video(video_url, sub_task_id)

            if filepath:
                download_progress[task_id]['videos'].append({
                    'title': video_title,
                    'filename': os.path.basename(filepath),
                    'status': 'completed'
                })
                download_progress[task_id]['completed_count'] = i + 1
            else:
                download_progress[task_id]['videos'].append({
                    'title': video_title,
                    'status': 'error',
                    'error': download_progress[sub_task_id].get('error', 'Unknown error')
                })

            # Atualiza progresso geral
            download_progress[task_id]['progress'] = ((i + 1) / total_videos) * 100

        download_progress[task_id]['status'] = 'completed'

    except Exception as e:
        download_progress[task_id]['status'] = 'error'
        download_progress[task_id]['error'] = str(e)


def process_queue_item(item):
    """Processa um item da fila"""
    task_id = item['task_id']
    url = item['url']
    item_type = item['type']

    with queue_lock:
        if task_id in queue_items:
            queue_items[task_id]['status'] = 'processing'

    download_progress[task_id] = {
        'status': 'starting',
        'progress': 0,
        'type': item_type,
        'url': url,
        'title': item.get('title', 'Carregando...')
    }

    if item_type == 'playlist':
        download_playlist(url, task_id)
    else:
        download_single_video(url, task_id)

    with queue_lock:
        if task_id in queue_items:
            queue_items[task_id]['status'] = download_progress[task_id]['status']
            queue_items[task_id]['completed_at'] = datetime.now().isoformat()


def queue_worker():
    """Worker que processa a fila de downloads"""
    global worker_running
    while worker_running:
        try:
            item = download_queue.get(timeout=1)
            process_queue_item(item)
            download_queue.task_done()
        except:
            continue


def start_worker():
    """Inicia o worker da fila se não estiver rodando"""
    global worker_thread, worker_running
    if worker_thread is None or not worker_thread.is_alive():
        worker_running = True
        worker_thread = threading.Thread(target=queue_worker, daemon=True)
        worker_thread.start()


def detect_url_type(url):
    """Detecta se a URL é de vídeo ou playlist"""
    if 'list=' in url:
        return 'playlist'
    return 'video'


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/info', methods=['POST'])
def get_info():
    """Obtém informações do vídeo ou playlist"""
    data = request.json
    url = data.get('url', '')
    cookies = data.get('cookies', '')

    if not url:
        return jsonify({'error': 'URL não fornecida'}), 400

    try:
        info = get_video_info(url, cookies)

        is_playlist = 'entries' in info

        if is_playlist:
            entries = list(info['entries'])
            return jsonify({
                'type': 'playlist',
                'title': info.get('title', 'Playlist'),
                'count': len(entries),
                'videos': [
                    {
                        'id': e['id'],
                        'title': e.get('title', 'Sem título'),
                        'duration': e.get('duration', 0)
                    } for e in entries if e
                ]
            })
        else:
            return jsonify({
                'type': 'video',
                'title': info.get('title', 'Sem título'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'channel': info.get('channel', info.get('uploader', ''))
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/download', methods=['POST'])
def start_download():
    """Inicia o download de um vídeo ou playlist"""
    data = request.json
    url = data.get('url', '')
    download_type = data.get('type', 'video')
    cookies = data.get('cookies', '')

    if not url:
        return jsonify({'error': 'URL não fornecida'}), 400

    task_id = str(uuid.uuid4())

    # Armazena cookies para esta tarefa
    if cookies:
        task_cookies[task_id] = cookies

    download_progress[task_id] = {
        'status': 'starting',
        'progress': 0,
        'type': download_type
    }

    if download_type == 'playlist':
        thread = threading.Thread(target=download_playlist, args=(url, task_id))
    else:
        thread = threading.Thread(target=download_single_video, args=(url, task_id))

    thread.start()

    return jsonify({'task_id': task_id})


@app.route('/api/batch', methods=['POST'])
def add_to_batch():
    """Adiciona múltiplas URLs à fila de download"""
    data = request.json
    urls = data.get('urls', [])
    cookies = data.get('cookies', '')

    if not urls:
        return jsonify({'error': 'Nenhuma URL fornecida'}), 400

    # Garante que o worker está rodando
    start_worker()

    added_items = []

    for url in urls:
        url = url.strip()
        if not url:
            continue

        task_id = str(uuid.uuid4())
        url_type = detect_url_type(url)

        # Armazena cookies para esta tarefa
        if cookies:
            task_cookies[task_id] = cookies

        # Tenta obter o título
        title = url
        try:
            info = get_video_info(url, cookies)
            title = info.get('title', url)
        except:
            pass

        item = {
            'task_id': task_id,
            'url': url,
            'type': url_type,
            'title': title,
            'status': 'queued',
            'added_at': datetime.now().isoformat()
        }

        with queue_lock:
            queue_items[task_id] = item

        download_queue.put(item)

        added_items.append({
            'task_id': task_id,
            'url': url,
            'type': url_type,
            'title': title
        })

    return jsonify({
        'message': f'{len(added_items)} itens adicionados à fila',
        'items': added_items
    })


@app.route('/api/queue')
def get_queue():
    """Retorna o estado atual da fila"""
    with queue_lock:
        items = []
        for task_id, item in queue_items.items():
            progress = download_progress.get(task_id, {})
            items.append({
                'task_id': task_id,
                'url': item['url'],
                'type': item['type'],
                'title': item['title'],
                'status': item['status'],
                'progress': progress.get('progress', 0),
                'current_video': progress.get('current_video'),
                'current_index': progress.get('current_index'),
                'total': progress.get('total'),
                'error': progress.get('error'),
                'added_at': item['added_at'],
                'completed_at': item.get('completed_at')
            })

        # Ordena: processando primeiro, depois na fila, depois completados
        status_order = {'processing': 0, 'queued': 1, 'completed': 2, 'error': 3}
        items.sort(key=lambda x: (status_order.get(x['status'], 4), x['added_at']))

        return jsonify({
            'queue_size': download_queue.qsize(),
            'total_items': len(items),
            'items': items
        })


@app.route('/api/queue/<task_id>', methods=['DELETE'])
def remove_from_queue(task_id):
    """Remove um item da fila (se ainda não estiver processando)"""
    with queue_lock:
        if task_id in queue_items:
            if queue_items[task_id]['status'] == 'queued':
                queue_items[task_id]['status'] = 'cancelled'
                return jsonify({'message': 'Item removido da fila'})
            else:
                return jsonify({'error': 'Item já está sendo processado'}), 400
        return jsonify({'error': 'Item não encontrado'}), 404


@app.route('/api/queue/clear', methods=['POST'])
def clear_queue():
    """Limpa itens completados/com erro da fila"""
    with queue_lock:
        to_remove = [
            task_id for task_id, item in queue_items.items()
            if item['status'] in ['completed', 'error', 'cancelled']
        ]
        for task_id in to_remove:
            del queue_items[task_id]

    return jsonify({'message': f'{len(to_remove)} itens removidos'})


@app.route('/api/progress/<task_id>')
def get_progress(task_id):
    """Retorna o progresso de um download"""
    if task_id not in download_progress:
        return jsonify({'error': 'Task não encontrada'}), 404

    return jsonify(download_progress[task_id])


@app.route('/api/download-file/<task_id>')
def download_file(task_id):
    """Baixa o arquivo MP3 resultante"""
    if task_id not in download_progress:
        return jsonify({'error': 'Task não encontrada'}), 404

    task = download_progress[task_id]

    if task.get('status') != 'completed':
        return jsonify({'error': 'Download ainda não completado'}), 400

    filepath = task.get('filepath')

    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'Arquivo não encontrado'}), 404

    return send_file(filepath, as_attachment=True)


@app.route('/api/list-downloads')
def list_downloads():
    """Lista todos os arquivos baixados"""
    files = []
    for f in DOWNLOAD_FOLDER.glob('*.mp3'):
        files.append({
            'name': f.name,
            'size': f.stat().st_size,
            'modified': f.stat().st_mtime
        })
    return jsonify(files)


@app.route('/api/download-existing/<filename>')
def download_existing(filename):
    """Baixa um arquivo já existente"""
    filepath = DOWNLOAD_FOLDER / filename
    if not filepath.exists():
        return jsonify({'error': 'Arquivo não encontrado'}), 404
    return send_file(filepath, as_attachment=True)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
