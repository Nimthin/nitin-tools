package com.nitintools.app.feature.youtubeaudio.data

import com.google.gson.annotations.SerializedName

/**
 * Request body for /api/cobalt
 */
data class CobaltRequest(
    val action: String,
    val url: String
)

/**
 * Response from /api/cobalt — info action
 */
data class CobaltInfoResponse(
    @SerializedName("status") val status: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("author") val author: String? = null,
    @SerializedName("duration") val duration: Int? = null,
    @SerializedName("thumbnail") val thumbnail: String? = null,
    @SerializedName("message") val message: String? = null
)

/**
 * Response from /api/cobalt — download action
 */
data class CobaltDownloadResponse(
    @SerializedName("status") val status: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("url") val downloadUrl: String? = null,
    @SerializedName("message") val message: String? = null
)
