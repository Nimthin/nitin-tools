package com.nitintools.app.feature.musicplayer.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.nitintools.app.core.ui.theme.*
import com.nitintools.app.feature.musicplayer.data.models.Track
import com.nitintools.app.feature.musicplayer.viewmodel.MusicPlayerViewModel

@Composable
fun MusicPlayerScreen(viewModel: MusicPlayerViewModel = hiltViewModel()) {
    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val globalTrending by viewModel.globalTrending.collectAsState()
    val indiaTrending by viewModel.indiaTrending.collectAsState()
    val playerState by viewModel.state.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(bottom = if (playerState.currentTrack != null) 80.dp else 0.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            item {
                Text(
                    "🎵 NitinMusic",
                    style = MaterialTheme.typography.displayMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )
            }

            // Search bar
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = viewModel::updateSearchQuery,
                    placeholder = { Text("Search for any song...", color = MaterialTheme.colorScheme.onSurfaceVariant) },
                    leadingIcon = { Icon(Icons.Rounded.Search, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AccentGreen,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        cursorColor = AccentGreen
                    ),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { viewModel.search() }),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)
                )
            }

            // Search Results — BIG thumbnail cards with overlay text
            if (searchResults.isNotEmpty()) {
                item {
                    Text("Search Results", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp))
                }
                itemsIndexed(searchResults) { index, track ->
                    SearchResultCard(track = track, onClick = { viewModel.playTrack(track, searchResults, index) })
                }
            } else if (isSearching) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = AccentGreen, strokeWidth = 2.dp)
                    }
                }
            }

            // Trending charts — show only when no search
            if (searchResults.isEmpty() && !isSearching) {
                if (globalTrending.isNotEmpty()) {
                    item { TrendingCarousel("🌍 Global Top 20", globalTrending, viewModel) }
                }
                if (indiaTrending.isNotEmpty()) {
                    item { TrendingCarousel("🇮🇳 India Top 20", indiaTrending, viewModel) }
                }
            }
        }

        // Now Playing Bar
        if (playerState.currentTrack != null && !playerState.isMinimized && !playerState.isMaximized) {
            NowPlayingBar(
                state = playerState,
                onPlayPause = viewModel::togglePlayPause,
                onNext = viewModel::playNext,
                onPrev = viewModel::playPrev,
                onExpand = { viewModel.setMaximized(true) },
                onMinimize = { viewModel.setMinimized(true) },
                onSeek = viewModel::seekTo,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        if (playerState.currentTrack != null && playerState.isMinimized) {
            MiniWidget(
                state = playerState,
                onPlayPause = viewModel::togglePlayPause,
                onExpand = { viewModel.setMaximized(true) },
                modifier = Modifier.align(Alignment.BottomEnd)
            )
        }

        if (playerState.currentTrack != null && playerState.isMaximized) {
            FullScreenPlayer(
                state = playerState,
                onClose = { viewModel.setMaximized(false) },
                onPlayPause = viewModel::togglePlayPause,
                onNext = viewModel::playNext,
                onPrev = viewModel::playPrev,
                onSeek = viewModel::seekTo,
                onSkipForward = viewModel::skipForward,
                onSkipBackward = viewModel::skipBackward,
                onVolumeChange = viewModel::setVolume,
                onSpeedChange = viewModel::setPlaybackSpeed,
                onToggleLyrics = viewModel::toggleLyrics,
                onToggleVideo = viewModel::toggleVideo
            )
        }
    }
}

/**
 * Big thumbnail search result card with details overlaid on the image.
 */
@Composable
fun SearchResultCard(track: Track, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp)
            .height(180.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Big thumbnail background
            AsyncImage(
                model = track.artwork,
                contentDescription = track.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )

            // Gradient overlay at bottom
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f)),
                            startY = 60f
                        )
                    )
            )

            // Text overlay
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp)
            ) {
                Text(
                    text = track.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (track.artist.isNotBlank()) {
                    Text(
                        text = track.artist,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.8f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
fun TrendingCarousel(title: String, tracks: List<Track>, viewModel: MusicPlayerViewModel) {
    Column(modifier = Modifier.padding(vertical = 12.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp))

        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            itemsIndexed(tracks) { index, track ->
                Column(
                    modifier = Modifier.width(140.dp).clip(RoundedCornerShape(12.dp)).clickable { viewModel.playTrack(track, tracks, index) },
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AsyncImage(
                        model = track.artwork, contentDescription = track.title,
                        modifier = Modifier.size(140.dp).clip(RoundedCornerShape(12.dp)),
                        contentScale = ContentScale.Crop
                    )
                    Text(track.title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onBackground, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(track.artist, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}
