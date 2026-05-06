package com.nitintools.app.feature.chatbot.data

import com.google.gson.annotations.SerializedName

/**
 * Request body: sends array of messages with role + content
 */
data class ChatRequest(
    val messages: List<ChatMessageDto>
)

data class ChatMessageDto(
    val role: String,   // "user" or "assistant"
    val content: String
)

/**
 * Response from /api/chat — returns { message: "..." }
 */
data class ChatApiResponse(
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)
