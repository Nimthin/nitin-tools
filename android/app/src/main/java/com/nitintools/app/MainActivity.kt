package com.nitintools.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.nitintools.app.core.ui.navigation.NitinBottomNavBar
import com.nitintools.app.core.ui.navigation.NitinNavGraph
import com.nitintools.app.core.ui.navigation.Screen
import com.nitintools.app.core.ui.theme.NitinToolsTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Single Activity architecture. Light mode by default, with dark mode toggle.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            // Light mode by default, user can toggle
            var isDarkMode by rememberSaveable { mutableStateOf(false) }

            NitinToolsTheme(isDark = isDarkMode) {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Home.route

                val showBottomBar = currentRoute in listOf(
                    Screen.Home.route,
                    Screen.MusicPlayer.route,
                    Screen.Chatbot.route
                )

                Scaffold(
                    containerColor = androidx.compose.material3.MaterialTheme.colorScheme.background,
                    bottomBar = {
                        if (showBottomBar) {
                            NitinBottomNavBar(
                                currentRoute = currentRoute,
                                onNavigate = { route ->
                                    navController.navigate(route) {
                                        popUpTo(Screen.Home.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            )
                        }
                    }
                ) { innerPadding ->
                    NitinNavGraph(
                        navController = navController,
                        isDarkMode = isDarkMode,
                        onToggleTheme = { isDarkMode = !isDarkMode },
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    )
                }
            }
        }
    }
}
