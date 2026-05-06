package com.nitintools.app.feature.youtubeaudio.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object YouTubeAudioModule {

    @Provides
    @Singleton
    fun provideCobaltApi(retrofit: Retrofit): CobaltApi {
        return retrofit.create(CobaltApi::class.java)
    }
}
