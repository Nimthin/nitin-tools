package com.nitintools.app.core.ui.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.nitintools.app.feature.chatbot.ui.ChatbotScreen
import com.nitintools.app.feature.fileconverter.ui.FileConverterScreen
import com.nitintools.app.feature.home.HomeScreen
import com.nitintools.app.feature.image.ui.BackgroundRemoverScreen
import com.nitintools.app.feature.image.ui.ImageHubScreen
import com.nitintools.app.feature.image.ui.ImageToTextScreen
import com.nitintools.app.feature.musicplayer.ui.MusicPlayerScreen
import com.nitintools.app.feature.pdf.ui.ImageToPdfScreen
import com.nitintools.app.feature.pdf.ui.PdfHubScreen
import com.nitintools.app.feature.pdf.ui.PdfMergerScreen
import com.nitintools.app.feature.pdf.ui.PdfPageRemoverScreen
import com.nitintools.app.feature.youtubeaudio.ui.YouTubeAudioScreen

@Composable
fun NitinNavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    isDarkMode: Boolean = false,
    onToggleTheme: () -> Unit = {},
    startDestination: String = Screen.Home.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
        enterTransition = { fadeIn(tween(200)) + slideInHorizontally(initialOffsetX = { it / 6 }, animationSpec = tween(200)) },
        exitTransition = { fadeOut(tween(150)) },
        popEnterTransition = { fadeIn(tween(200)) + slideInHorizontally(initialOffsetX = { -it / 6 }, animationSpec = tween(200)) },
        popExitTransition = { fadeOut(tween(150)) + slideOutHorizontally(targetOffsetX = { it / 6 }, animationSpec = tween(200)) }
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                onNavigateToTool = { route -> navController.navigate(route) },
                isDarkMode = isDarkMode,
                onToggleTheme = onToggleTheme
            )
        }
        composable(Screen.MusicPlayer.route) { MusicPlayerScreen() }
        composable(Screen.YouTubeAudio.route) { YouTubeAudioScreen() }
        composable(Screen.PdfHub.route) { PdfHubScreen(onNavigate = { navController.navigate(it) }) }
        composable(Screen.ImageToPdf.route) { ImageToPdfScreen() }
        composable(Screen.PdfPageRemover.route) { PdfPageRemoverScreen() }
        composable(Screen.PdfMerger.route) { PdfMergerScreen() }
        composable(Screen.ImageHub.route) { ImageHubScreen(onNavigate = { navController.navigate(it) }) }
        composable(Screen.BackgroundRemover.route) { BackgroundRemoverScreen() }
        composable(Screen.ImageToText.route) { ImageToTextScreen() }
        composable(Screen.FileConverter.route) { FileConverterScreen() }
        composable(Screen.Chatbot.route) { ChatbotScreen() }
    }
}
