package com.nitintools.app.feature.chatbot.data

import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Retrofit service for the chat API.
 */
interface ChatApi {

    @POST("api/chat")
    suspend fun sendMessage(
        @Body body: ChatRequest
    ): ChatApiResponse
}
