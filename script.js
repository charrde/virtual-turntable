document.addEventListener('DOMContentLoaded', () => {
    // ================================
    //          DOM Elements
    // ================================
    const playPauseButton = document.getElementById('play-pause');
    const record = document.getElementById('record');
    const audio = document.getElementById('audio');
    const speedSelector = document.getElementById('speed');
    const turntable = document.querySelector('.turntable');
    const trackNameDisplay = document.getElementById('track-name');
    const volumeControl = document.getElementById('volume-control');
    const progress = document.getElementById('progress');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalDurationDisplay = document.getElementById('total-duration');
    const turntableDropzone = document.getElementById('turntable-dropzone');
    const queueDropzone = document.getElementById('queue-dropzone');
    const queueList = document.getElementById('queue-list');
    const visualizer = document.getElementById('visualizer');
    const fileInput = document.getElementById('file-input');
    const youtubeUrlInput = document.getElementById('youtube-url-input');
    const addYouTubeUrlButton = document.getElementById('add-youtube-url');
    const skipButton = document.getElementById('skip');
    const goBackButton = document.getElementById('go-back');
    const volumeControlGroup = document.querySelector('.control-group.volume-control');
    const volumeButton = document.getElementById('volume-button');
    const volumeSliderContainer = document.querySelector('.volume-slider-container');
    const volumeSlider = document.getElementById('volume-control');
    const toggleButton = document.getElementById('media-center-toggle');
    const mediaCenter = document.querySelector('.media-center');
    const tonearm = document.getElementById('tonearm');
    const menuButton = document.getElementById('menu-button');
    const toggledControls = document.getElementById('toggled-controls');
    const speedButton = document.getElementById('speed-button');
    const speedDropdown = document.getElementById('speed-dropdown');
    const speedOptions = document.querySelectorAll('.speed-option');
    //const speedValueDisplay = document.getElementById('speed-value');
    const loadingIndicator = document.getElementById('loading-indicator');
    const tryOutFile = document.getElementById('try-out-file');
    const tryOutYouTube = document.getElementById('try-out-youtube');

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    // ================================
    //          State Variables
    // ================================
    let isPlaying = false;
    let queue = [];
    let historyStack = []; // Stack to keep track of played tracks
    let currentSource = null; // To track current audio source ('audio' or 'youtube')
    let youtubeUpdateInterval = null; // Interval for updating YouTube progress
    let currentTrack = null; // Currently playing track

    // ================================
    //       Audio Context Setup
    // ================================
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    let sourceNode = null;

    // Function to connect audio source to analyser
    function connectAudioSource(audioElement) {
        if (sourceNode) {
            sourceNode.disconnect();
        }
        sourceNode = audioContext.createMediaElementSource(audioElement);
        sourceNode.connect(analyser);
        analyser.connect(audioContext.destination);
    }

    // ================================
    //        Canvas Visualization
    // ================================
    const canvas = visualizer;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#333'; // Background color
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            ctx.fillStyle = '#e74c3c'; // Bar color
            ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
            x += barWidth + 1;
        }
    }

    drawVisualizer();

    // ================================
    //    YouTube API Initialization
    // ================================

    // Flag to track YouTube API readiness
    let isYouTubeAPIReady = false;

    // Disable YouTube inputs initially
    youtubeUrlInput.disabled = true;
    addYouTubeUrlButton.disabled = true;

    // Set a timeout to handle API load failure (e.g., 10 seconds)
    const youtubeAPITimeout = setTimeout(() => {
        if (!isYouTubeAPIReady) {
            alert('Failed to load YouTube API. YouTube features will be unavailable.');
            hideLoadingIndicator();
        }
    }, 10000); // 10,000 milliseconds = 10 seconds

    // ================================
    //    YouTube IFrame Player Setup
    // ================================

    let youtubePlayer;
    function onYouTubeIframeAPIReady() {
        youtubePlayer = new YT.Player('youtube-player', {
            height: '0', // Hide the player
            width: '0',
            videoId: '', // Will be set dynamically
            events: {
                'onStateChange': onYouTubePlayerStateChange,
                'onReady': onYouTubePlayerReady
            }
        });
    }
    window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

    // Function called when YouTube Player is ready
    function onYouTubePlayerReady(event) {
        isYouTubeAPIReady = true;
        enableYouTubeFeatures();
        hideLoadingIndicator();
        clearTimeout(youtubeAPITimeout);
    }

    // Function to enable YouTube-related inputs
    function enableYouTubeFeatures() {
        youtubeUrlInput.disabled = false;
        addYouTubeUrlButton.disabled = false;
    }

    // Function to hide the loading indicator
    function hideLoadingIndicator() {
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }

    // ================================
    //          File Input Handling
    // ================================
    queueDropzone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('audio/')) {
            addToQueue({ type: 'file', data: file });
        } else {
            alert('Please select a valid audio file.');
        }
        fileInput.value = ''; // Reset the input value
    });

    // ================================
    // Handle YouTube player state changes
    // ================================
    function onYouTubePlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            isPlaying = true;
            playPauseButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
            turntable.classList.add('playing');
            turntable.classList.remove('paused');

            if (!youtubeUpdateInterval) {
                youtubeUpdateInterval = setInterval(updateYouTubeProgress, 1000);
            }

            // Update Media Session Playback State
            updateMediaSessionState('playing');
        } else if (event.data === YT.PlayerState.PAUSED) {
            isPlaying = false;
            playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
            turntable.classList.add('paused');
            turntable.classList.remove('playing');

            if (youtubeUpdateInterval) {
                clearInterval(youtubeUpdateInterval);
                youtubeUpdateInterval = null;
            }

            // Update Media Session Playback State
            updateMediaSessionState('paused');
        } else if (event.data === YT.PlayerState.ENDED) {
            isPlaying = false;
            playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
            turntable.classList.remove('playing');
            turntable.classList.add('paused');
            progress.style.width = '0%';
            currentTimeDisplay.textContent = '00:00';
            totalDurationDisplay.textContent = '00:00';

            if (youtubeUpdateInterval) {
                clearInterval(youtubeUpdateInterval);
                youtubeUpdateInterval = null;
            }

            // Reset Tonearm Rotation
            resetTonearm();

            // Update Media Session Playback State
            updateMediaSessionState('none');

            playNextInQueue();
        }
    }

    function moveTonearmTo(degree) {
        tonearm.style.transition = 'transform 1.5s ease'; // Smooth transition
        tonearm.style.transform = `rotate(${degree}deg)`;
    }

    function updateTonearmRotation(currentTime, duration) {
        // Angle between 60° (start) and 50° (end)
        const minDegree = 50; // Minimum rotation degree
        const maxDegree = 60; // Rotation degree at the start
        const rotationDegree = maxDegree - ((currentTime / duration) * (maxDegree - minDegree));
        tonearm.style.transform = `rotate(${rotationDegree}deg)`;
    }

    function resetTonearm() {
        tonearm.style.transition = 'transform 1.5s ease';
        tonearm.style.transform = `rotate(90deg)`;
    }

    // Function to update YouTube progress and duration
    function updateYouTubeProgress() {
        const currentTime = youtubePlayer.getCurrentTime();
        const duration = youtubePlayer.getDuration();

        if (duration) {
            const progressPercent = (currentTime / duration) * 100;
            progress.style.width = `${progressPercent}%`;

            currentTimeDisplay.textContent = formatTime(currentTime);

            if (totalDurationDisplay.textContent === '00:00') {
                totalDurationDisplay.textContent = formatTime(duration);
            }

            updateTonearmRotation(currentTime, duration);

            // Update Media Session Playback Position
            updateMediaSessionPosition(currentTime, duration);
        }
    }

    // ================================
    //      Media Center Toggle
    // ================================
    const toggleMediaCenterFunction = () => {
        mediaCenter.classList.toggle('active');

        // Update aria-expanded attribute for accessibility
        const isActive = mediaCenter.classList.contains('active');
        toggleButton.setAttribute('aria-expanded', isActive);

        // Change toggle button icon based on state
        const icon = toggleButton.querySelector('i');
    };
    toggleButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling up
        toggleMediaCenterFunction();
    });

    // Close media center when clicking outside
    document.addEventListener('click', (event) => {
        if (!mediaCenter.contains(event.target) && !toggleButton.contains(event.target)) {
            if (mediaCenter.classList.contains('active')) {
                mediaCenter.classList.remove('active');
                toggleButton.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // ================================
    //       Play/Pause Functionality
    // ================================
    playPauseButton.addEventListener('click', () => {
        if (currentSource === 'audio') {
            if (audio.paused) {
                if (!audio.src) {
                    if (queue.length > 0) {
                        playNextInQueue();
                    } else {
                        alert('Please add a track to the queue.');
                        return;
                    }
                }
                audioContext.resume(); // Resume AudioContext if suspended
                audio.play();
                record.classList.remove('paused');
                playPauseButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
                turntable.classList.add('playing');
                turntable.classList.remove('paused');
                isPlaying = true;

                // Move tonearm back to the current position based on the current time in the track
                updateTonearmRotation(audio.currentTime, audio.duration);

                // Update Media Session Playback State
                updateMediaSessionState('playing');
            } else {
                audio.pause();
                record.classList.add('paused');
                playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
                turntable.classList.add('paused');
                turntable.classList.remove('playing');
                isPlaying = false;

                // Move the tonearm back to 90° on pause
                moveTonearmTo(90);

                // Update Media Session Playback State
                updateMediaSessionState('paused');
            }
        } else if (currentSource === 'youtube') {
            const playerState = youtubePlayer.getPlayerState();
            if (playerState === YT.PlayerState.PLAYING) {
                youtubePlayer.pauseVideo();
                record.classList.add('paused');
                playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
                turntable.classList.add('paused');
                turntable.classList.remove('playing');
                isPlaying = false;

                // Move the tonearm back to 90° on pause
                moveTonearmTo(90);

                // Update Media Session Playback State
                updateMediaSessionState('paused');
            } else {
                if (!youtubePlayer.getVideoData().video_id) {
                    if (queue.length > 0) {
                        playNextInQueue();
                    } else {
                        alert('Please add a track to the queue.');
                        return;
                    }
                }
                audioContext.resume(); // Resume AudioContext if suspended
                youtubePlayer.playVideo();
                record.classList.remove('paused');
                playPauseButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
                turntable.classList.add('playing');
                turntable.classList.remove('paused');
                isPlaying = true;

                // Move tonearm back to the current position based on the current time in the video
                updateTonearmRotation(youtubePlayer.getCurrentTime(), youtubePlayer.getDuration());

                // Update Media Session Playback State
                updateMediaSessionState('playing');
            }
        }
    });

    //event listener for the try out file button. play the file located at 'audio/track.mp3'
    tryOutFile.addEventListener('click', () => {
        addToQueue({ type: 'file', data: 'audio/track.mp3', title: 'Arctic Monkey - Do I Wanna Know?' });
    });

    //event listener for the try out youtube button. play the video with the id 'dQw4w9WgXcQ'
    tryOutYouTube.addEventListener('click', () => {
        fetchVideoDetails('dQw4w9WgXcQ')
            .then(videoDetails => {
                addToQueue({ type: 'youtube', data: videoDetails });
            }
            )
            .catch(err => {
                console.error('Error fetching video details:', err);
                alert('Failed to fetch video details. Please check the console for more information.');
            }
            );
    });

    // ================================
    //         Speed Control
    // ================================

    speedOptions.forEach(option => {
        option.addEventListener('click', () => {
            const selectedSpeed = option.getAttribute('data-speed');
            let playbackRate;

            if (currentSource === 'audio') {
                playbackRate = parseFloat(selectedSpeed) / 33.33;
                audio.playbackRate = playbackRate;
            }

            else if (currentSource === 'youtube') {
                switch (selectedSpeed) {
                    case '33.33':
                        playbackRate = 1;
                        break;
                    case '45':
                        playbackRate = 1.25;
                        break;
                    case '78':
                        playbackRate = 2;
                        break;
                    default:
                        alert('Unsupported speed selected.');
                        return;
                }

                const availableRates = youtubePlayer.getAvailablePlaybackRates();
                if (availableRates.includes(playbackRate)) {
                    youtubePlayer.setPlaybackRate(playbackRate);
                } else {
                    alert(`Playback rate ${playbackRate}x not supported by YouTube.`);
                }
            }

            speedButton.setAttribute('aria-expanded', 'false');
            speedDropdown.classList.remove('active');
        });
    });

    // Close the dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!speedDropdown.contains(e.target) && !speedButton.contains(e.target)) {
            speedButton.setAttribute('aria-expanded', 'false');
            speedDropdown.classList.remove('active');
        }
    });

    // Prevent clicks inside speedDropdown from closing the dropdown
    speedDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Toggle speed dropdown
    speedButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = speedButton.getAttribute('aria-expanded') === 'true';
        speedButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        speedDropdown.classList.toggle('active');
    });

    // Initialize default playback speed if necessary
    // This ensures that the playback rate is set based on the default value
    const defaultSpeed = '33.33';
    const defaultPlaybackRate = parseFloat(defaultSpeed) / 33.33; // Equals 1.0
    if (currentSource === 'audio') {
        audio.playbackRate = defaultPlaybackRate;
    } else if (currentSource === 'youtube') {
        youtubePlayer.setPlaybackRate(defaultPlaybackRate);
    }

    // ================================
    //        Menu Toggle Functionality
    // ================================
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling up
        toggledControls.classList.toggle('active');
    });

    // Close toggled controls when clicking outside
    document.addEventListener('click', (e) => {
        if (!toggledControls.contains(e.target) && !menuButton.contains(e.target)) {
            toggledControls.classList.remove('active');
        }
    });

    // Prevent clicks inside toggledControls from closing the menu
    toggledControls.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // ================================
    //          Volume Control
    // ================================
    volumeControl.addEventListener('input', (e) => {
        audio.volume = e.target.value;
        if (currentSource === 'youtube') {
            youtubePlayer.setVolume(e.target.value * 100);
        }
        updateVolumeIcon(e.target.value);
    });

    volumeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from propagating to the document
        volumeControlGroup.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!volumeControlGroup.contains(e.target)) {
            volumeControlGroup.classList.remove('active');
        }
    });

    volumeSliderContainer.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    function updateVolumeIcon(volume) {
        const volumeIcon = volumeButton.querySelector('i');
        if (volume === 0) {
            volumeIcon.className = 'bi bi-volume-mute';
        } else if (volume < 0.5) {
            volumeIcon.className = 'bi bi-volume-down';
        } else {
            volumeIcon.className = 'bi bi-volume-up';
        }
    }

    // Initialize icon
    updateVolumeIcon(volumeSlider.value);

    // Update icon on volume change
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value;
        audio.volume = volume;
        if (currentSource === 'youtube') {
            youtubePlayer.setVolume(volume * 100);
        }
        updateVolumeIcon(volume);
    });

    // ================================
    //      Progress Bar & Time
    // ================================
    // Update Progress Bar and Time Displays for Audio
    audio.addEventListener('timeupdate', () => {
        if (currentSource === 'audio' && audio.duration) {
            const progressPercent = (audio.currentTime / audio.duration) * 100;
            progress.style.width = `${progressPercent}%`;

            currentTimeDisplay.textContent = formatTime(audio.currentTime);
            totalDurationDisplay.textContent = formatTime(audio.duration);

            // Update Tonearm Rotation
            updateTonearmRotation(audio.currentTime, audio.duration);

            // Update Media Session Playback Position
            updateMediaSessionPosition(audio.currentTime, audio.duration);
        }
    });

    // Function to format time in mm:ss
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
    }

    // Reset Progress Bar and Tonearm when audio ends
    audio.addEventListener('ended', () => {
        if (currentSource === 'audio') {
            record.classList.add('paused');
            playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
            turntable.classList.remove('playing');
            turntable.classList.add('paused');
            isPlaying = false;
            progress.style.width = '0%';
            currentTimeDisplay.textContent = '00:00';
            totalDurationDisplay.textContent = '00:00';

            resetTonearm();

            // Update Media Session Playback State
            updateMediaSessionState('none');

            playNextInQueue();
        }
    });

    // ================================
    //     Drag-and-Drop File Upload
    // ================================

    // Prevent default behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        turntableDropzone.addEventListener(eventName, preventDefaults, false);
        queueDropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop zone when file is dragged over
    ['dragenter', 'dragover'].forEach(eventName => {
        turntableDropzone.addEventListener(eventName, () => {
            turntableDropzone.classList.add('dragover');
        }, false);
        queueDropzone.addEventListener(eventName, () => {
            queueDropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        turntableDropzone.addEventListener(eventName, () => {
            turntableDropzone.classList.remove('dragover');
        }, false);
        queueDropzone.addEventListener(eventName, () => {
            queueDropzone.classList.remove('dragover');
        }, false);
    });

    // Handle dropped files on Turntable (Add to Queue)
    turntableDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('audio/')) {
                addToQueue({ type: 'file', data: file });
            } else {
                alert('Please drop a valid audio file.');
            }
        }
    });

    // Handle dropped files on Queue Dropzone
    queueDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('audio/')) {
                addToQueue({ type: 'file', data: file });
            } else {
                alert('Please drop a valid audio file.');
            }
        }
    });

    // ================================
    //      YouTube URL Handling
    // ================================
    // Handle adding YouTube URLs to the queue
    addYouTubeUrlButton.addEventListener('click', () => {
        if (!isYouTubeAPIReady) { // **Prevent action if API not ready**
            alert('YouTube features are still loading. Please wait a moment.');
            return;
        }

        const url = youtubeUrlInput.value.trim();
        if (isValidYouTubeUrl(url)) {
            const videoId = extractYouTubeVideoID(url);
            const playlistId = extractYouTubePlaylistID(url);
            if (playlistId) {
                fetchPlaylistItems(playlistId);
                youtubeUrlInput.value = '';
            } else if (videoId) {
                fetchVideoDetails(videoId)
                    .then(videoDetails => {
                        addToQueue({ type: 'youtube', data: videoDetails });
                        youtubeUrlInput.value = '';
                    })
                    .catch(err => {
                        console.error('Error fetching video details:', err);
                        alert('Failed to fetch video details. Please check the console for more information.');
                    });
            } else {
                alert('Invalid YouTube URL.');
            }
        } else {
            alert('Please enter a valid YouTube URL.');
        }
    });

    // Function to validate YouTube URL
    function isValidYouTubeUrl(url) {
        const pattern = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/;
        return pattern.test(url);
    }

    // Function to extract YouTube Video ID
    function extractYouTubeVideoID(url) {
        const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return (match && match[1]) ? match[1] : null;
    }

    // Function to extract YouTube Playlist ID
    function extractYouTubePlaylistID(url) {
        const regex = /[?&]list=([a-zA-Z0-9_-]+)/;
        const match = url.match(regex);
        return (match && match[1]) ? match[1] : null;
    }

    // Function to fetch video details using YouTube Data API
    async function fetchVideoDetails(videoId) {
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'Failed to fetch video details');
            }
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const video = data.items[0];
                return {
                    videoId: video.id,
                    title: video.snippet.title,
                    artist: video.snippet.channelTitle, // Channel name as artist
                    artwork: [{
                        src: video.snippet.thumbnails.high.url,
                        sizes: '512x512',
                        type: 'image/jpeg'
                    }]
                };
            } else {
                throw new Error('Video not found');
            }
        } catch (error) {
            console.error('Error in fetchVideoDetails:', error);
            throw error;
        }
    }

    // Function to fetch all videos from a playlist using YouTube Data API
    async function fetchPlaylistItems(playlistId) {
        let nextPageToken = '';
        let videos = [];

        try {
            do {
                const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error.message || `Failed to fetch playlist items (status: ${response.status})`);
                }
                const data = await response.json();
                if (data.items) {
                    data.items.forEach(item => {
                        if (item.snippet && item.snippet.resourceId.kind === 'youtube#video') {
                            videos.push({
                                videoId: item.snippet.resourceId.videoId,
                                title: item.snippet.title,
                                artist: item.snippet.videoOwnerChannelTitle || 'Unknown Artist', // Channel name as artist
                                artwork: [{
                                    src: item.snippet.thumbnails.high.url,
                                    sizes: '512x512',
                                    type: 'image/jpeg'
                                }]
                            });
                        }
                    });
                }
                nextPageToken = data.nextPageToken;
            } while (nextPageToken);

            videos.forEach(video => {
                queue.push({ type: 'youtube', data: video });
            });
            updateQueueDisplay();

            if (!isPlaying && queue.length > 0) {
                playNextInQueue();
            }
        } catch (error) {
            console.error('Error in fetchPlaylistItems:', error);
            alert('Failed to fetch playlist items. Please check the console for more information.');
        }
    }

    // ================================
    //        Queue Management
    // ================================
    // Function to play the next track in the queue
    function playNextInQueue() {
        if (queue.length === 0 && !isPlaying) {
            trackNameDisplay.textContent = 'None';
            mediaCenter.classList.remove('active');
            toggleButton.setAttribute('aria-expanded', 'false');
            return;
        }
        const nextItem = queue.shift();
        if (currentTrack) {
            historyStack.push(currentTrack); // Push current track to history
        }
        currentTrack = nextItem; // Update current track
        updateQueueDisplay();
        playItem(nextItem);
    }

    // Function to play an item (audio file or YouTube video)
    function playItem(item) {
        // Delay duration in milliseconds (1.5 seconds)
        const delayDuration = 1500;

        if (item.type === 'file') {
            currentSource = 'audio';
            const fileURL = URL.createObjectURL(item.data);
            audio.src = fileURL;
            audio.load();

            audio.volume = volumeControl.value;

            trackNameDisplay.textContent = `${item.data.name}`;

            record.classList.remove('paused');
            playPauseButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
            turntable.classList.add('playing');
            turntable.classList.remove('paused');
            isPlaying = true;

            currentTimeDisplay.textContent = '00:00';
            totalDurationDisplay.textContent = '00:00';

            connectAudioSource(audio);

            // Move the tonearm to 60° before starting the audio (with transition)
            moveTonearmTo(60);

            // Delay before playing audio
            setTimeout(() => {
                audio.play();

                // Set Media Session Metadata
                setMediaSessionMetadata({
                    title: item.data.name,
                    artist: item.data.artist || 'Unknown Artist',
                    album: item.data.album || 'Unknown Album',
                    artwork: item.data.artwork || []
                });
            }, delayDuration);

        } else if (item.type === 'youtube') {
            currentSource = 'youtube';
            trackNameDisplay.textContent = `${item.data.title}`;
            youtubePlayer.setVolume(volumeControl.value * 100);

            record.classList.remove('paused');
            playPauseButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
            turntable.classList.add('playing');
            turntable.classList.remove('paused');
            isPlaying = true;

            currentTimeDisplay.textContent = '00:00';
            totalDurationDisplay.textContent = '00:00';

            // Move the tonearm to 60° before starting the YouTube video (with transition)
            moveTonearmTo(60);

            // Delay before playing YouTube video
            setTimeout(() => {
                youtubePlayer.loadVideoById(item.data.videoId);

                // Set Media Session Metadata
                setMediaSessionMetadata({
                    title: item.data.title,
                    artist: item.data.artist || 'Unknown Artist',
                    album: item.data.album || 'Unknown Album',
                    artwork: item.data.artwork || []
                });
            }, delayDuration);
        }
        mediaCenter.classList.add('active'); // Ensure media center is open when playing
        toggleButton.setAttribute('aria-expanded', 'true');
    }

    // Function to add an item to the queue
    function addToQueue(item) {
        queue.push(item);
        updateQueueDisplay();

        if (!isPlaying) {
            playNextInQueue();
        }
    }

    // Function to update the queue display
    function updateQueueDisplay() {
        queueList.innerHTML = '';

        queue.forEach((item, index) => {
            const li = document.createElement('li');
            li.dataset.index = index; // Store the index for reference

            const p = document.createElement('p');
            li.appendChild(p);

            if (item.type === 'file') {
                const audioIcon = document.createElement('i');
                audioIcon.classList.add('bi', 'bi-music-note-beamed');
                p.appendChild(audioIcon);
                p.appendChild(document.createTextNode(` ${item.data.name || 'Queued Track'}`));
            } else if (item.type === 'youtube') {
                const youtubeIcon = document.createElement('i');
                youtubeIcon.classList.add('bi', 'bi-youtube');
                p.appendChild(youtubeIcon);
                p.appendChild(document.createTextNode(` ${item.data.title}`));
            }

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.classList.add('remove-btn');
            removeBtn.addEventListener('click', () => {
                // If the removed item is the current track, stop it and play next
                if (currentTrack === item) {
                    stopCurrentTrack();
                    playNextInQueue();
                } else {
                    // Remove from queue
                    queue.splice(index, 1);
                    updateQueueDisplay();
                }
            });

            li.appendChild(removeBtn);
            queueList.appendChild(li);
        });

        // Initialize SortableJS if included and not already initialized
        if (typeof Sortable !== 'undefined' && !queueList.SortableInstance) {
            Sortable.create(queueList, {
                animation: 150,
                onEnd: function (evt) {
                    const movedItem = queue.splice(evt.oldIndex, 1)[0];
                    queue.splice(evt.newIndex, 0, movedItem);
                    updateQueueDisplay();
                }
            });
            queueList.SortableInstance = true; // Prevent multiple initializations
        }
    }

    // Function to stop the currently playing track
    function stopCurrentTrack() {
        if (currentSource === 'audio') {
            audio.pause();
            audio.currentTime = 0;
        } else if (currentSource === 'youtube') {
            youtubePlayer.stopVideo();
        }
        if (queue.length === 0) {
            mediaCenter.classList.remove('active');
            toggleButton.setAttribute('aria-expanded', 'false');
            const icon = toggleButton.querySelector('i');
        }
        isPlaying = false;
        record.classList.add('paused');
        playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
        turntable.classList.remove('playing');
        turntable.classList.add('paused');
        progress.style.width = '0%';
        currentTimeDisplay.textContent = '00:00';
        totalDurationDisplay.textContent = '00:00';

        resetTonearm();

        // Update Media Session Playback State
        updateMediaSessionState('none');
    }

    // Event Listeners for Skip and Go Back
    skipButton.addEventListener('click', () => {
        if (queue.length > 0) {
            skipCurrentTrack();
        } else {
            alert('No more tracks in the queue.');
        }
    });

    goBackButton.addEventListener('click', () => {
        if (historyStack.length > 0) {
            goBackToPreviousTrack();
        } else {
            alert('No previous tracks in history.');
        }
    });

    // Function to skip the current track and play the next one
    function skipCurrentTrack() {
        stopCurrentTrack();
        playNextInQueue();
    }

    // Function to go back to the previous track
    function goBackToPreviousTrack() {
        const previousTrack = historyStack.pop();
        if (previousTrack) {
            // If there is a current track, push it back to the queue
            if (currentTrack) {
                queue.unshift(currentTrack);
            }
            currentTrack = previousTrack;
            updateQueueDisplay();
            playItem(previousTrack);
        }
    }

    // ================================
    //          Progress Bar
    // ================================
    const progressBar = document.querySelector('.progress-bar');

    progressBar.addEventListener('click', (e) => {
        if (currentSource === 'audio' && audio.duration) {
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const clickRatio = clickX / width;
            const newTime = clickRatio * audio.duration;

            audio.currentTime = newTime;

            // Update Media Session Playback Position
            updateMediaSessionPosition(newTime, audio.duration);
        } else if (currentSource === 'youtube') {
            const duration = youtubePlayer.getDuration();
            if (duration) {
                const rect = progressBar.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const clickRatio = clickX / width;
                const newTime = clickRatio * duration;

                youtubePlayer.seekTo(newTime, true);

                // Update Media Session Playback Position
                updateMediaSessionPosition(newTime, duration);
            }
        }
    });

    // Close media center when pressing Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mediaCenter.classList.contains('active')) {
            mediaCenter.classList.remove('active');
            toggleButton.setAttribute('aria-expanded', 'false');
            const icon = toggleButton.querySelector('i');
        }
    });

    // ================================
    //     Media Session API Integration
    // ================================

    // Define Media Session functions outside the condition to avoid ReferenceError
    function setMediaSessionMetadata(metadata) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: metadata.title || '',
                artist: metadata.artist || '',
                album: metadata.album || '',
                artwork: metadata.artwork || []
            });
        }
    }

    function updateMediaSessionState(state) {
        if ('mediaSession' in navigator) {
            switch (state) {
                case 'playing':
                    navigator.mediaSession.playbackState = 'playing';
                    break;
                case 'paused':
                    navigator.mediaSession.playbackState = 'paused';
                    break;
                case 'none':
                    navigator.mediaSession.playbackState = 'none';
                    break;
                default:
                    navigator.mediaSession.playbackState = 'none';
            }
        }
    }

    function updateMediaSessionPosition(currentTime, duration) {
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: currentSource === 'audio' ? audio.playbackRate : youtubePlayer.getPlaybackRate(),
                position: currentTime
            });
        }
    }

    // Set Action Handlers if Media Session API is supported
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            playPauseButton.click();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            playPauseButton.click();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            goBackButton.click();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            skipButton.click();
        });

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            const seekTime = details.seekOffset || 10;
            if (currentSource === 'audio') {
                audio.currentTime = Math.max(audio.currentTime - seekTime, 0);
            } else if (currentSource === 'youtube') {
                youtubePlayer.seekTo(Math.max(youtubePlayer.getCurrentTime() - seekTime, 0), true);
            }
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const seekTime = details.seekOffset || 10;
            if (currentSource === 'audio') {
                audio.currentTime = Math.min(audio.currentTime + seekTime, audio.duration);
            } else if (currentSource === 'youtube') {
                youtubePlayer.seekTo(Math.min(youtubePlayer.getCurrentTime() + seekTime, youtubePlayer.getDuration()), true);
            }
        });
    }
});
