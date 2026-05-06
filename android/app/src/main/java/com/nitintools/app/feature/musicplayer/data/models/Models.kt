package com.nitintools.app.feature.musicplayer.data.models

/**
 * Represents a single music track.
 */
data class Track(
    val id: String = "",
    val title: String = "",
    val artist: String = "",
    val album: String = "",
    val artwork: String = "",
    val previewUrl: String = "",
    val videoId: String = "",
    val streamUrl: String = ""
)

/**
 * A single line of synced lyrics with its timestamp.
 */
data class LyricLine(
    val time: Double,
    val text: String
)

/**
 * Lyrics data — either synced (with timestamps) or plain text.
 */
sealed class LyricsData {
    data class Synced(val lines: List<LyricLine>) : LyricsData()
    data class Plain(val text: String) : LyricsData()
    data class Error(val message: String) : LyricsData()
    data object Loading : LyricsData()
    data object None : LyricsData()
}

/**
 * YouTube search result from the API.
 */
data class YouTubeSearchResult(
    val videoId: String,
    val title: String,
    val thumbnail: String,
    val channel: String? = null,
    val duration: String? = null
)

/**
 * Responses from the Vercel API.
 */
data class YouTubeSearchResponse(val results: List<YouTubeSearchResult>?)
data class AudioStreamResponse(val streamUrl: String?)

/**
 * LRCLIB lyrics response.
 */
data class LrcLibResponse(
    val syncedLyrics: String?,
    val plainLyrics: String?
)

/**
 * Player state for the UI.
 */
data class PlayerState(
    val currentTrack: Track? = null,
    val isPlaying: Boolean = false,
    val isLoading: Boolean = false,
    val currentTime: Long = 0L,
    val duration: Long = 0L,
    val volume: Float = 0.8f,
    val playbackSpeed: Float = 1f,
    val queue: List<Track> = emptyList(),
    val queueIndex: Int = -1,
    val isMinimized: Boolean = false,
    val isMaximized: Boolean = false,
    val lyrics: LyricsData = LyricsData.None,
    val showLyrics: Boolean = false,
    val showVideo: Boolean = false
)
