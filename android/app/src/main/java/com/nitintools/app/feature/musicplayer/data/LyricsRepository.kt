package com.nitintools.app.feature.musicplayer.data

import com.nitintools.app.feature.musicplayer.data.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LyricsRepository @Inject constructor(
    private val lyricsApi: LyricsApiService
) {
    /**
     * Fetch lyrics for a given track. Returns synced, plain, or error.
     * Runs on IO dispatcher for network safety.
     */
    suspend fun getLyrics(trackName: String, artistName: String): LyricsData = withContext(Dispatchers.IO) {
        try {
            // Clean track name (remove feat, ft, etc for better matching)
            val cleanTitle = trackName
                .replace(Regex("\\(.*?\\)"), "")
                .replace(Regex("\\[.*?]"), "")
                .replace(Regex("\\s*(feat|ft|featuring)\\.?\\s.*", RegexOption.IGNORE_CASE), "")
                .trim()
            val cleanArtist = artistName
                .replace(Regex("\\s*(feat|ft|featuring)\\.?\\s.*", RegexOption.IGNORE_CASE), "")
                .trim()

            val response = lyricsApi.getLyrics(cleanTitle, cleanArtist)

            if (!response.syncedLyrics.isNullOrBlank()) {
                val lines = response.syncedLyrics.split("\n").mapNotNull { line ->
                    val regex = Regex("""\[(\d+):(\d+\.?\d*)](.*)""")
                    val match = regex.find(line)
                    if (match != null) {
                        val minutes = match.groupValues[1].toIntOrNull() ?: 0
                        val seconds = match.groupValues[2].toDoubleOrNull() ?: 0.0
                        val text = match.groupValues[3].trim()
                        if (text.isNotEmpty()) LyricLine(minutes * 60.0 + seconds, text)
                        else null
                    } else null
                }
                if (lines.isNotEmpty()) LyricsData.Synced(lines)
                else LyricsData.Error("No synced lyrics found.")
            } else if (!response.plainLyrics.isNullOrBlank()) {
                LyricsData.Plain(response.plainLyrics)
            } else {
                LyricsData.Error("No lyrics found for this song.")
            }
        } catch (e: Exception) {
            e.printStackTrace()
            LyricsData.Error("Lyrics not available.")
        }
    }
}
