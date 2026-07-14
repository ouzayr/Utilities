package com.ouzayr.tododiary.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.ouzayr.tododiary.model.PageTemplate
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

enum class DarkModeSetting { SYSTEM, LIGHT, DARK }

data class AppSettings(
    val penColorHex: String = "#1A237E",
    val penWidthDp: Float = 1.6f,
    val pressureGamma: Float = 1.0f,
    val fingerDrawing: Boolean = false, // palm rejection ON by default
    val template: PageTemplate = PageTemplate.DIARY,
    val darkMode: DarkModeSetting = DarkModeSetting.SYSTEM,
)

@Singleton
class SettingsRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val penColor = stringPreferencesKey("pen_color")
        val penWidth = floatPreferencesKey("pen_width")
        val pressureGamma = floatPreferencesKey("pressure_gamma")
        val fingerDrawing = booleanPreferencesKey("finger_drawing")
        val template = stringPreferencesKey("template")
        val darkMode = stringPreferencesKey("dark_mode")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            penColorHex = p[Keys.penColor] ?: "#1A237E",
            penWidthDp = p[Keys.penWidth] ?: 1.6f,
            pressureGamma = p[Keys.pressureGamma] ?: 1.0f,
            fingerDrawing = p[Keys.fingerDrawing] ?: false,
            template = runCatching { PageTemplate.valueOf(p[Keys.template] ?: "DIARY") }
                .getOrDefault(PageTemplate.DIARY),
            darkMode = runCatching { DarkModeSetting.valueOf(p[Keys.darkMode] ?: "SYSTEM") }
                .getOrDefault(DarkModeSetting.SYSTEM),
        )
    }

    suspend fun setPenColor(hex: String) = context.dataStore.edit { it[Keys.penColor] = hex }
    suspend fun setPenWidth(dp: Float) = context.dataStore.edit { it[Keys.penWidth] = dp }
    suspend fun setPressureGamma(g: Float) = context.dataStore.edit { it[Keys.pressureGamma] = g }
    suspend fun setFingerDrawing(enabled: Boolean) = context.dataStore.edit { it[Keys.fingerDrawing] = enabled }
    suspend fun setTemplate(t: PageTemplate) = context.dataStore.edit { it[Keys.template] = t.name }
    suspend fun setDarkMode(m: DarkModeSetting) = context.dataStore.edit { it[Keys.darkMode] = m.name }
}
