package com.nitintools.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Application class for NitinTools.
 * @HiltAndroidApp triggers Hilt's code generation for dependency injection.
 */
@HiltAndroidApp
class NitinToolsApp : Application()
