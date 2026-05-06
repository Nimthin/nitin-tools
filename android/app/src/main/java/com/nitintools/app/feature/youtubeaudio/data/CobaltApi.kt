package com.nitintools.app.feature.youtubeaudio.data

import retrofit2.http.Body
import retrofit2.http.POST

interface CobaltApi {

    @POST("api/cobalt")
    suspend fun getInfo(
        @Body body: CobaltRequest
    ): CobaltInfoResponse

    @POST("api/cobalt")
    suspend fun download(
        @Body body: CobaltRequest
    ): CobaltDownloadResponse
}
