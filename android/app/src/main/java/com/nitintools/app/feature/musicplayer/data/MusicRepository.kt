package com.nitintools.app.feature.musicplayer.data

import com.nitintools.app.feature.musicplayer.data.models.*
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MusicRepository @Inject constructor(
    private val musicApi: MusicApiService
) {
    suspend fun searchSongs(query: String): List<YouTubeSearchResult> {
        return try {
            val response = musicApi.searchYouTube(mapOf("query" to query))
            response.results ?: emptyList()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getStreamUrl(videoId: String): String? {
        return try {
            val response = musicApi.getAudioStream(mapOf("videoId" to videoId))
            response.streamUrl
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Fetch trending charts from iTunes RSS — runs on IO dispatcher.
     */
    suspend fun fetchTrending(country: String): List<Track> = withContext(Dispatchers.IO) {
        try {
            val url = "https://itunes.apple.com/$country/rss/topsongs/limit=20/json"
            val client = okhttp3.OkHttpClient.Builder()
                .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .build()
            val request = okhttp3.Request.Builder().url(url).build()
            val response = client.newCall(request).execute()

            if (!response.isSuccessful) return@withContext emptyList()

            val body = response.body?.string() ?: return@withContext emptyList()
            val gson = Gson()
            val jsonObj = gson.fromJson(body, Map::class.java)
            val feed = jsonObj["feed"] as? Map<*, *> ?: return@withContext emptyList()
            val entries = feed["entry"] as? List<*> ?: return@withContext emptyList()

            entries.mapIndexed { index, entry ->
                val map = entry as? Map<*, *> ?: return@mapIndexed null
                val name = (map["im:name"] as? Map<*, *>)?.get("label") as? String ?: ""
                val artist = (map["im:artist"] as? Map<*, *>)?.get("label") as? String ?: ""

                val images = map["im:image"] as? List<*>
                val artwork = if (images != null && images.isNotEmpty()) {
                    val lastImg = images.last() as? Map<*, *>
                    (lastImg?.get("label") as? String)
                        ?.replace("55x55", "600x600")
                        ?.replace("170x170", "600x600") ?: ""
                } else ""

                Track(
                    id = "$country-$index",
                    title = name,
                    artist = artist,
                    artwork = artwork
                )
            }.filterNotNull()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }
}
