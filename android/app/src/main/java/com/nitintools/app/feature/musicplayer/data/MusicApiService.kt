package com.nitintools.app.feature.musicplayer.data

import com.nitintools.app.feature.musicplayer.data.models.AudioStreamResponse
import com.nitintools.app.feature.musicplayer.data.models.YouTubeSearchResponse
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Retrofit API service for music search and streaming.
 * Calls your Vercel backend endpoints.
 */
interface MusicApiService {

    @POST("api/youtube-search")
    suspend fun searchYouTube(
        @Body body: Map<String, String>
    ): YouTubeSearchResponse

    @POST("api/audio-stream")
    suspend fun getAudioStream(
        @Body body: Map<String, String>
    ): AudioStreamResponse
}
