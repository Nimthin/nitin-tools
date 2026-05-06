package com.nitintools.app.feature.youtubeaudio.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.nitintools.app.core.ui.theme.*
import com.nitintools.app.feature.youtubeaudio.viewmodel.YouTubeAudioViewModel

/**
 * YouTube to MP3 download screen — fully wired to the Cobalt API.
 */
@Composable
fun YouTubeAudioScreen(
    viewModel: YouTubeAudioViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "🎧 YouTube to MP3",
            style = MaterialTheme.typography.displayMedium,
            color = TextPrimary
        )

        Text(
            text = "Paste a YouTube URL to download audio as MP3",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary
        )

        // URL Input
        OutlinedTextField(
            value = state.url,
            onValueChange = viewModel::updateUrl,
            placeholder = { Text("Paste YouTube URL here...", color = TextTertiary) },
            leadingIcon = { Icon(Icons.Rounded.Link, null, tint = TextTertiary) },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = ErrorRed,
                unfocusedBorderColor = BorderColor,
                focusedContainerColor = DarkSurfaceElevated,
                unfocusedContainerColor = DarkSurfaceElevated,
                cursorColor = ErrorRed,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary
            ),
            modifier = Modifier.fillMaxWidth()
        )

        // Fetch Info Button
        Button(
            onClick = viewModel::fetchInfo,
            enabled = state.url.isNotBlank() && !state.isLoading,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            if (state.isLoading) {
                CircularProgressIndicator(color = TextPrimary, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Fetching info...", color = TextPrimary)
            } else {
                Icon(Icons.Rounded.Search, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Fetch Video Info", style = MaterialTheme.typography.labelLarge)
            }
        }

        // Error message
        if (state.error.isNotBlank()) {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = ErrorRed.copy(alpha = 0.12f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.ErrorOutline, null, tint = ErrorRed, modifier = Modifier.size(20.dp))
                    Text(state.error, style = MaterialTheme.typography.bodyMedium, color = ErrorRed)
                }
            }
        }

        // Video Preview (shown after fetch)
        if (state.title.isNotBlank()) {
            Card(
                modifier = Modifier.fillMaxWidth().animateContentSize(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (state.thumbnail.isNotBlank()) {
                        AsyncImage(
                            model = state.thumbnail,
                            contentDescription = state.title,
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(16f / 9f)
                                .clip(RoundedCornerShape(12.dp)),
                            contentScale = ContentScale.Crop
                        )
                    }
                    Text(
                        state.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (state.duration > 0) {
                        val min = state.duration / 60
                        val sec = state.duration % 60
                        Text(
                            "Duration: ${min}m ${sec}s",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextTertiary
                        )
                    }

                    // Download Button
                    Button(
                        onClick = viewModel::download,
                        enabled = !state.isDownloading,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = AccentGreen),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        if (state.isDownloading) {
                            CircularProgressIndicator(color = TextOnAccent, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Downloading...", color = TextOnAccent)
                        } else {
                            Icon(Icons.Rounded.Download, null, tint = TextOnAccent, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Download MP3", style = MaterialTheme.typography.labelLarge, color = TextOnAccent)
                        }
                    }
                }
            }
        }

        // Success message
        if (state.isComplete) {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = SuccessGreen.copy(alpha = 0.12f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(20.dp))
                    Text("Download started! Check your Music folder.", style = MaterialTheme.typography.bodyMedium, color = SuccessGreen)
                }
            }
        }
    }
}
