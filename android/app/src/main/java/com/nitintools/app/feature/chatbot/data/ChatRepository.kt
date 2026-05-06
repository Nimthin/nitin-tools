package com.nitintools.app.feature.chatbot.data

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository that manages chat conversation history and API calls.
 */
@Singleton
class ChatRepository @Inject constructor(
    private val chatApi: ChatApi
) {
    private val conversationHistory = mutableListOf<ChatMessageDto>()

    /**
     * Send a user message and get the AI reply.
     * Maintains full conversation history for context.
     */
    suspend fun sendMessage(userMessage: String): String {
        // Add user message to history
        conversationHistory.add(ChatMessageDto(role = "user", content = userMessage))

        return try {
            val response = chatApi.sendMessage(
                ChatRequest(messages = conversationHistory.toList())
            )

            val reply = response.message ?: response.error ?: "Sorry, I couldn't process that."

            // Add assistant reply to history
            conversationHistory.add(ChatMessageDto(role = "assistant", content = reply))

            reply
        } catch (e: Exception) {
            e.printStackTrace()
            "Sorry, something went wrong. Please check your connection and try again."
        }
    }

    fun clearHistory() {
        conversationHistory.clear()
    }
}
