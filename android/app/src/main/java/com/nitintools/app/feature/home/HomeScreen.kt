package com.nitintools.app.feature.home

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.nitintools.app.core.ui.components.NitinSearchBar
import com.nitintools.app.core.ui.components.ToolCard
import com.nitintools.app.core.ui.navigation.Screen
import com.nitintools.app.core.ui.theme.*

data class ToolItem(
    val title: String,
    val description: String,
    val icon: String,
    val route: String,
    val accent: androidx.compose.ui.graphics.Color = AccentGreen
)

private val allTools = listOf(
    ToolItem("NitinMusic", "Your personal ad-free music player. Search any song, stream it instantly, and enjoy trending charts.", "🎵", Screen.MusicPlayer.route, AccentGreen),
    ToolItem("YouTube to MP3", "Download audio from any YouTube video directly as an MP3. Choose your quality — up to 320 kbps.", "🎧", Screen.YouTubeAudio.route, ErrorRed),
    ToolItem("Image Toolkit", "Remove backgrounds with AI, or extract text from any picture. All processed privately on your device.", "🖼️", Screen.ImageHub.route, AccentPurple),
    ToolItem("PDF Toolkit", "Remove pages, merge PDFs, or convert images into a single PDF. All processed securely on your device.", "📄", Screen.PdfHub.route, AccentBlue),
    ToolItem("File Converter", "Change a file into another format — documents, images, audio, or video. Everything happens privately.", "🔄", Screen.FileConverter.route, AccentOrange),
    ToolItem("AI Chatbot", "Chat with an intelligent AI assistant. Get answers, brainstorm ideas, and solve problems instantly.", "🤖", Screen.Chatbot.route, AccentCyan),
)

@Composable
fun HomeScreen(
    onNavigateToTool: (String) -> Unit,
    isDarkMode: Boolean = false,
    onToggleTheme: () -> Unit = {}
) {
    var searchQuery by remember { mutableStateOf("") }

    val filteredTools = remember(searchQuery) {
        if (searchQuery.isBlank()) allTools
        else allTools.filter {
            it.title.contains(searchQuery, ignoreCase = true) ||
                    it.description.contains(searchQuery, ignoreCase = true)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
    ) {
        // ---- Top Bar with Theme Toggle ----
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.End
        ) {
            IconButton(onClick = onToggleTheme) {
                Icon(
                    imageVector = if (isDarkMode) Icons.Rounded.LightMode else Icons.Rounded.DarkMode,
                    contentDescription = "Toggle theme",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // ---- Hero Section ----
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Your Personal",
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(brush = Brush.horizontalGradient(listOf(GradientStart, GradientEnd)))) {
                        append("Toolkit")
                    }
                },
                style = MaterialTheme.typography.displayLarge,
            )

            Spacer(modifier = Modifier.height(24.dp))

            NitinSearchBar(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                modifier = Modifier.widthIn(max = 500.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = if (filteredTools.isNotEmpty()) "Available Tools" else "No tools found",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
        )

        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 160.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            itemsIndexed(filteredTools) { index, tool ->
                var visible by remember { mutableStateOf(false) }
                LaunchedEffect(Unit) { kotlinx.coroutines.delay(index * 60L); visible = true }

                AnimatedVisibility(
                    visible = visible,
                    enter = fadeIn(tween(300)) + slideInVertically(initialOffsetY = { it / 4 }, animationSpec = tween(300))
                ) {
                    ToolCard(
                        title = tool.title,
                        description = tool.description,
                        icon = tool.icon,
                        accentColor = tool.accent,
                        onClick = { onNavigateToTool(tool.route) }
                    )
                }
            }
        }
    }
}
