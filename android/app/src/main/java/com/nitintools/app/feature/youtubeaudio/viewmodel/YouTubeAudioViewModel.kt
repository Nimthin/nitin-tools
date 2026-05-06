package com.nitintools.app.feature.youtubeaudio.viewmodel

import android.app.Application
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nitintools.app.feature.youtubeaudio.data.CobaltApi
import com.nitintools.app.feature.youtubeaudio.data.CobaltRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class YouTubeAudioState(
    val url: String = "",
    val isLoading: Boolean = false,
    val title: String = "",
    val thumbnail: String = "",
    val duration: Int = 0,
    val error: String = "",
    val isDownloading: Boolean = false,
    val isComplete: Boolean = false
)

@HiltViewModel
class YouTubeAudioViewModel @Inject constructor(
    application: Application,
    private val cobaltApi: CobaltApi
) : AndroidViewModel(application) {

    private val _state = MutableStateFlow(YouTubeAudioState())
    val state: StateFlow<YouTubeAudioState> = _state.asStateFlow()

    fun updateUrl(url: String) {
        _state.value = _state.value.copy(url = url, error = "")
    }

    fun fetchInfo() {
        val url = _state.value.url.trim()
        if (url.isBlank()) return

        _state.value = _state.value.copy(isLoading = true, error = "", title = "", thumbnail = "", isComplete = false)

        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    cobaltApi.getInfo(CobaltRequest(action = "info", url = url))
                }
                if (response.status == "success") {
                    _state.value = _state.value.copy(
                        title = response.title ?: "Unknown",
                        thumbnail = response.thumbnail ?: "",
                        duration = response.duration ?: 0,
                        isLoading = false
                    )
                } else {
                    _state.value = _state.value.copy(
                        error = response.message ?: "Could not fetch video info. Check the URL.",
                        isLoading = false
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
                _state.value = _state.value.copy(
                    error = "Connection error: ${e.message ?: "Unknown error"}. Please check your internet.",
                    isLoading = false
                )
            }
        }
    }

    fun download() {
        val url = _state.value.url.trim()
        if (url.isBlank()) return

        _state.value = _state.value.copy(isDownloading = true, error = "")

        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    cobaltApi.download(CobaltRequest(action = "download", url = url))
                }
                if (response.status == "success" && !response.downloadUrl.isNullOrBlank()) {
                    val fileName = "${response.title ?: "audio"}.mp3"
                        .replace(Regex("[^a-zA-Z0-9._\\- ]"), "") // sanitize filename

                    val request = DownloadManager.Request(Uri.parse(response.downloadUrl))
                        .setTitle(fileName)
                        .setDescription("Downloading from NitinTools")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_MUSIC, fileName)
                        .setAllowedOverMetered(true)

                    val dm = getApplication<Application>().getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(request)

                    _state.value = _state.value.copy(isDownloading = false, isComplete = true)
                } else {
                    _state.value = _state.value.copy(
                        error = response.message ?: "Download failed. Try a different video.",
                        isDownloading = false
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
                _state.value = _state.value.copy(
                    error = "Download error: ${e.message ?: "Unknown"}",
                    isDownloading = false
                )
            }
        }
    }
}
