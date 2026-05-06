package com.nitintools.app.feature.musicplayer.data

import com.nitintools.app.feature.musicplayer.data.models.*
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Retrofit API service for LRCLIB synced lyrics.
 */
interface LyricsApiService {

    @GET("api/get")
    suspend fun getLyrics(
        @Query("track_name") trackName: String,
        @Query("artist_name") artistName: String
    ): LrcLibResponse
}
