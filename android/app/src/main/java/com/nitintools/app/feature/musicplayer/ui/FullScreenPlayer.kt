package com.nitintools.app.feature.musicplayer.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.nitintools.app.core.ui.theme.*
import com.nitintools.app.feature.musicplayer.data.models.*
import kotlinx.coroutines.launch

/**
 * Full-screen immersive music player view.
 */
@Composable
fun FullScreenPlayer(
    state: PlayerState,
    onClose: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onSeek: (Long) -> Unit,
    onSkipForward: () -> Unit,
    onSkipBackward: () -> Unit,
    onVolumeChange: (Float) -> Unit,
    onSpeedChange: (Float) -> Unit,
    onToggleLyrics: () -> Unit,
    onToggleVideo: () -> Unit
) {
    val track = state.currentTrack ?: return

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ---- Top Bar ----
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onClose) {
                    Icon(Icons.Rounded.Close, "Close", tint = TextSecondary, modifier = Modifier.size(28.dp))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(onClick = onToggleVideo) {
                        Icon(
                            Icons.Rounded.Videocam,
                            "Video",
                            tint = if (state.showVideo) AccentGreen else TextTertiary,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    IconButton(onClick = onToggleLyrics) {
                        Icon(
                            Icons.Rounded.Lyrics,
                            "Lyrics",
                            tint = if (state.showLyrics) AccentGreen else TextTertiary,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }

            // ---- Main Content ----
            if (state.showLyrics) {
                // Side-by-side: Art + Lyrics
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    // Left: Album art
                    Column(
                        modifier = Modifier.weight(0.4f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        AsyncImage(
                            model = track.artwork,
                            contentDescription = track.title,
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(16.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = track.title,
                            style = MaterialTheme.typography.titleLarge,
                            color = TextPrimary,
                            textAlign = TextAlign.Center,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = track.artist,
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary,
                            textAlign = TextAlign.Center
                        )
                    }

                    // Right: Lyrics
                    LyricsPanel(
                        lyrics = state.lyrics,
                        currentTimeMs = state.currentTime,
                        modifier = Modifier.weight(0.6f)
                    )
                }
            } else {
                // Centered album art
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    AsyncImage(
                        model = track.artwork,
                        contentDescription = track.title,
                        modifier = Modifier
                            .fillMaxWidth(0.65f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(16.dp)),
                        contentScale = ContentScale.Crop
                    )
                    Spacer(Modifier.height(32.dp))
                    Text(
                        text = track.title,
                        style = MaterialTheme.typography.headlineMedium,
                        color = TextPrimary,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = buildString {
                            append(track.artist)
                            if (track.album.isNotBlank()) append(" • ${track.album}")
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    )
                }
            }

            // ---- Progress ----
            Column(modifier = Modifier.padding(horizontal = 24.dp)) {
                Slider(
                    value = if (state.duration > 0) state.currentTime.toFloat() / state.duration else 0f,
                    onValueChange = { pct -> onSeek((pct * state.duration).toLong()) },
                    colors = SliderDefaults.colors(
                        thumbColor = AccentGreen,
                        activeTrackColor = AccentGreen,
                        inactiveTrackColor = BorderColor
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(formatTime(state.currentTime), style = MaterialTheme.typography.labelSmall, color = TextTertiary)
                    Text(formatTime(state.duration), style = MaterialTheme.typography.labelSmall, color = TextTertiary)
                }
            }

            // ---- Playback Controls ----
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onSkipBackward, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Rounded.Replay10, "Back 10s", tint = TextSecondary, modifier = Modifier.size(28.dp))
                }
                IconButton(onClick = onPrev, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Rounded.SkipPrevious, "Previous", tint = TextPrimary, modifier = Modifier.size(32.dp))
                }
                // Big play button
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(Color.White)
                        .clickable(onClick = onPlayPause),
                    contentAlignment = Alignment.Center
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(color = Color.Black, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
                    } else {
                        Icon(
                            if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            "Play/Pause",
                            tint = Color.Black,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }
                IconButton(onClick = onNext, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Rounded.SkipNext, "Next", tint = TextPrimary, modifier = Modifier.size(32.dp))
                }
                IconButton(onClick = onSkipForward, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Rounded.Forward10, "Forward 10s", tint = TextSecondary, modifier = Modifier.size(28.dp))
                }
            }

            // ---- Speed + Volume ----
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Speed controls
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(DarkSurfaceElevated)
                        .padding(4.dp)
                ) {
                    listOf(0.5f, 1f, 1.5f, 2f).forEach { speed ->
                        Text(
                            text = "${speed}x",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (state.playbackSpeed == speed) Color.Black else TextSecondary,
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (state.playbackSpeed == speed) AccentGreen else Color.Transparent)
                                .clickable { onSpeedChange(speed) }
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                // Volume
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(DarkSurfaceElevated)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Icon(
                        if (state.volume == 0f) Icons.Rounded.VolumeOff else Icons.Rounded.VolumeUp,
                        "Volume",
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                    Slider(
                        value = state.volume,
                        onValueChange = onVolumeChange,
                        modifier = Modifier.width(80.dp),
                        colors = SliderDefaults.colors(
                            thumbColor = AccentGreen,
                            activeTrackColor = AccentGreen,
                            inactiveTrackColor = BorderColor
                        )
                    )
                }
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}

/**
 * Lyrics panel — synced, plain, or error state.
 */
@Composable
fun LyricsPanel(
    lyrics: LyricsData,
    currentTimeMs: Long,
    modifier: Modifier = Modifier
) {
    val currentTimeSec = currentTimeMs / 1000.0
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    when (lyrics) {
        is LyricsData.Loading -> {
            Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentGreen, strokeWidth = 2.dp)
            }
        }
        is LyricsData.Synced -> {
            // Auto-scroll to active lyric
            val activeIndex = lyrics.lines.indexOfLast { it.time <= currentTimeSec }.coerceAtLeast(0)
            LaunchedEffect(activeIndex) {
                scope.launch {
                    listState.animateScrollToItem(
                        index = activeIndex,
                        scrollOffset = -200
                    )
                }
            }

            LazyColumn(
                state = listState,
                modifier = modifier.fillMaxSize(),
                contentPadding = PaddingValues(vertical = 60.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                itemsIndexed(lyrics.lines) { index, line ->
                    val isActive = index == activeIndex
                    Text(
                        text = line.text,
                        fontSize = if (isActive) 22.sp else 18.sp,
                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.SemiBold,
                        color = if (isActive) TextPrimary else TextTertiary.copy(alpha = 0.5f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .animateContentSize(tween(200))
                    )
                }
            }
        }
        is LyricsData.Plain -> {
            LazyColumn(
                modifier = modifier.fillMaxSize(),
                contentPadding = PaddingValues(vertical = 40.dp)
            ) {
                item {
                    Text(
                        text = lyrics.text,
                        style = MaterialTheme.typography.bodyLarge,
                        color = TextSecondary,
                        lineHeight = 28.sp
                    )
                }
            }
        }
        is LyricsData.Error -> {
            Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(lyrics.message, style = MaterialTheme.typography.bodyMedium, color = TextTertiary)
            }
        }
        else -> {
            Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Lyrics not available", style = MaterialTheme.typography.bodyMedium, color = TextTertiary)
            }
        }
    }
}

/**
 * Format milliseconds to mm:ss string.
 */
private fun formatTime(ms: Long): String {
    val totalSec = ms / 1000
    val min = totalSec / 60
    val sec = totalSec % 60
    return "$min:${sec.toString().padStart(2, '0')}"
}
