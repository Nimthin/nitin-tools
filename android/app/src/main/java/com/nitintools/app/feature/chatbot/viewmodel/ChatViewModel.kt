package com.nitintools.app.feature.chatbot.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nitintools.app.feature.chatbot.data.ChatRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatMessage(
    val text: String,
    val isUser: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

data class ChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val isTyping: Boolean = false
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val chatRepository: ChatRepository
) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = _state.asStateFlow()

    /**
     * Send a message and get an AI response.
     */
    fun sendMessage(text: String) {
        if (text.isBlank()) return

        // Add user message to UI
        val userMsg = ChatMessage(text = text.trim(), isUser = true)
        _state.value = _state.value.copy(
            messages = _state.value.messages + userMsg,
            isTyping = true
        )

        // Call the API
        viewModelScope.launch {
            val reply = chatRepository.sendMessage(text.trim())
            val aiMsg = ChatMessage(text = reply, isUser = false)
            _state.value = _state.value.copy(
                messages = _state.value.messages + aiMsg,
                isTyping = false
            )
        }
    }

    fun clearChat() {
        chatRepository.clearHistory()
        _state.value = ChatUiState()
    }
}
