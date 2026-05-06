package com.nitintools.app.feature.musicplayer.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.nitintools.app.feature.musicplayer.data.LyricsRepository
import com.nitintools.app.feature.musicplayer.data.MusicRepository
import com.nitintools.app.feature.musicplayer.data.models.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MusicPlayerViewModel @Inject constructor(
    application: Application,
    private val musicRepository: MusicRepository,
    private val lyricsRepository: LyricsRepository
) : AndroidViewModel(application) {

    private val _state = MutableStateFlow(PlayerState())
    val state: StateFlow<PlayerState> = _state.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _searchResults = MutableStateFlow<List<Track>>(emptyList())
    val searchResults: StateFlow<List<Track>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _globalTrending = MutableStateFlow<List<Track>>(emptyList())
    val globalTrending: StateFlow<List<Track>> = _globalTrending.asStateFlow()

    private val _indiaTrending = MutableStateFlow<List<Track>>(emptyList())
    val indiaTrending: StateFlow<List<Track>> = _indiaTrending.asStateFlow()

    private var progressJob: Job? = null
    private var searchJob: Job? = null

    val exoPlayer: ExoPlayer = ExoPlayer.Builder(application).build().apply {
        addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _state.update { it.copy(isPlaying = isPlaying) }
                if (isPlaying) startProgressUpdater() else stopProgressUpdater()
            }
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    _state.update { it.copy(duration = duration.coerceAtLeast(0)) }
                }
                if (playbackState == Player.STATE_ENDED) playNext()
            }
        })
    }

    init { fetchTrending() }

    private fun fetchTrending() {
        viewModelScope.launch { _globalTrending.value = musicRepository.fetchTrending("us") }
        viewModelScope.launch { _indiaTrending.value = musicRepository.fetchTrending("in") }
    }

    // ---- Dynamic Search: clears results when query is empty ----
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        if (query.isBlank()) {
            _searchResults.value = emptyList()
            _isSearching.value = false
            searchJob?.cancel()
            return
        }
        // Auto-search with debounce
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(500) // debounce 500ms
            performSearch(query)
        }
    }

    fun search() {
        val query = _searchQuery.value.trim()
        if (query.isBlank()) return
        searchJob?.cancel()
        searchJob = viewModelScope.launch { performSearch(query) }
    }

    private suspend fun performSearch(query: String) {
        _isSearching.value = true
        try {
            val results = musicRepository.searchSongs(query)
            _searchResults.value = results.map { result ->
                Track(
                    id = result.videoId,
                    title = result.title,
                    artist = result.channel ?: "",
                    artwork = result.thumbnail,
                    videoId = result.videoId
                )
            }
        } catch (e: Exception) {
            _searchResults.value = emptyList()
        } finally {
            _isSearching.value = false
        }
    }

    // ---- Playback ----
    fun playTrack(track: Track, trackList: List<Track>, index: Int) {
        _state.update {
            it.copy(
                currentTrack = track, queue = trackList, queueIndex = index,
                isLoading = true, isPlaying = false, currentTime = 0L, duration = 0L,
                lyrics = LyricsData.Loading
            )
        }

        viewModelScope.launch {
            val lyrics = lyricsRepository.getLyrics(track.title, track.artist)
            _state.update { it.copy(lyrics = lyrics) }
        }

        viewModelScope.launch {
            try {
                val videoId = if (track.videoId.isNotBlank()) {
                    track.videoId
                } else {
                    val results = musicRepository.searchSongs("${track.title} ${track.artist}")
                    if (results.isEmpty()) throw Exception("Not found")
                    results.first().videoId
                }
                _state.update { it.copy(currentTrack = it.currentTrack?.copy(videoId = videoId)) }

                val streamUrl = musicRepository.getStreamUrl(videoId)
                if (streamUrl.isNullOrBlank()) throw Exception("Stream failed")

                exoPlayer.setMediaItem(MediaItem.fromUri(streamUrl))
                exoPlayer.prepare()
                exoPlayer.playWhenReady = true
                exoPlayer.volume = _state.value.volume
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                _state.update { it.copy(isLoading = false) }
            }
        }
    }

    fun togglePlayPause() { if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play() }

    fun playNext() {
        val s = _state.value; if (s.queue.isEmpty()) return
        val nextIdx = (s.queueIndex + 1) % s.queue.size
        playTrack(s.queue[nextIdx], s.queue, nextIdx)
    }

    fun playPrev() {
        val s = _state.value; if (s.queue.isEmpty()) return
        if (exoPlayer.currentPosition > 3000) { exoPlayer.seekTo(0); return }
        val prevIdx = (s.queueIndex - 1 + s.queue.size) % s.queue.size
        playTrack(s.queue[prevIdx], s.queue, prevIdx)
    }

    fun seekTo(positionMs: Long) { exoPlayer.seekTo(positionMs); _state.update { it.copy(currentTime = positionMs) } }
    fun skipForward() { seekTo((exoPlayer.currentPosition + 10_000).coerceAtMost(exoPlayer.duration)) }
    fun skipBackward() { seekTo((exoPlayer.currentPosition - 10_000).coerceAtLeast(0)) }
    fun setVolume(vol: Float) { exoPlayer.volume = vol; _state.update { it.copy(volume = vol) } }
    fun setPlaybackSpeed(speed: Float) { exoPlayer.setPlaybackSpeed(speed); _state.update { it.copy(playbackSpeed = speed) } }
    fun setMinimized(value: Boolean) { _state.update { it.copy(isMinimized = value, isMaximized = false) } }
    fun setMaximized(value: Boolean) { _state.update { it.copy(isMaximized = value, isMinimized = false) } }
    fun toggleLyrics() { _state.update { it.copy(showLyrics = !it.showLyrics) } }
    fun toggleVideo() { _state.update { it.copy(showVideo = !it.showVideo) } }

    private fun startProgressUpdater() {
        progressJob?.cancel()
        progressJob = viewModelScope.launch {
            while (true) {
                _state.update { it.copy(currentTime = exoPlayer.currentPosition.coerceAtLeast(0)) }
                delay(250)
            }
        }
    }

    private fun stopProgressUpdater() { progressJob?.cancel() }

    override fun onCleared() {
        super.onCleared(); progressJob?.cancel(); exoPlayer.release()
    }
}
