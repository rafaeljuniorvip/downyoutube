# YouTube MP3 Downloader

Aplicativo web para baixar vídeos e playlists do YouTube em formato MP3.

## Requisitos

- Python 3.8+
- FFmpeg (necessário para conversão para MP3)

## Instalando FFmpeg no Windows

### Opção 1: Via Chocolatey
```bash
choco install ffmpeg
```

### Opção 2: Via Winget
```bash
winget install ffmpeg
```

### Opção 3: Download Manual
1. Baixe de: https://www.gyan.dev/ffmpeg/builds/
2. Extraia e adicione a pasta `bin` ao PATH do sistema

## Instalação

```bash
pip install -r requirements.txt
```

## Executando

```bash
python app.py
```

Acesse: http://localhost:5000

## Funcionalidades

- Download de vídeos individuais do YouTube
- Download de playlists completas
- Conversão automática para MP3 (192kbps)
- Interface moderna e responsiva
- Barra de progresso em tempo real
- Histórico de downloads anteriores

## Estrutura do Projeto

```
downyoutube/
├── app.py              # Backend Flask
├── requirements.txt    # Dependências Python
├── templates/
│   └── index.html      # Template HTML
├── static/
│   ├── style.css       # Estilos CSS
│   └── script.js       # JavaScript frontend
└── downloads/          # Pasta dos arquivos baixados
```
