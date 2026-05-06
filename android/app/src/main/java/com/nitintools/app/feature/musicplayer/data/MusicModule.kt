package com.nitintools.app.feature.musicplayer.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object MusicModule {

    @Provides
    @Singleton
    fun provideMusicApiService(retrofit: Retrofit): MusicApiService {
        return retrofit.create(MusicApiService::class.java)
    }

    @Provides
    @Singleton
    @Named("lyricsRetrofit")
    fun provideLyricsRetrofit(): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://lrclib.net/")
            .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideLyricsApiService(@Named("lyricsRetrofit") retrofit: Retrofit): LyricsApiService {
        return retrofit.create(LyricsApiService::class.java)
    }
}
