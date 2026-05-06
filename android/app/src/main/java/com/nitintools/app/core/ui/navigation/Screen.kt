package com.nitintools.app.core.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * All navigable screens in the app.
 */
sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object MusicPlayer : Screen("music_player")
    data object YouTubeAudio : Screen("youtube_audio")
    data object PdfHub : Screen("pdf_hub")
    data object ImageToPdf : Screen("image_to_pdf")
    data object PdfPageRemover : Screen("pdf_page_remover")
    data object PdfMerger : Screen("pdf_merger")
    data object ImageHub : Screen("image_hub")
    data object BackgroundRemover : Screen("background_remover")
    data object ImageToText : Screen("image_to_text")
    data object FileConverter : Screen("file_converter")
    data object Chatbot : Screen("chatbot")
}

/**
 * Items shown in the bottom navigation bar.
 */
data class BottomNavItem(
    val label: String,
    val icon: ImageVector,
    val route: String
)

val bottomNavItems = listOf(
    BottomNavItem("Home", Icons.Rounded.Home, Screen.Home.route),
    BottomNavItem("Music", Icons.Rounded.MusicNote, Screen.MusicPlayer.route),
    BottomNavItem("Chat", Icons.Rounded.ChatBubble, Screen.Chatbot.route),
)
