package com.ouzayr.tododiary.ui.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ouzayr.tododiary.auth.AuthRepository
import com.ouzayr.tododiary.data.AppSettings
import com.ouzayr.tododiary.data.DarkModeSetting
import com.ouzayr.tododiary.data.SettingsRepository
import com.ouzayr.tododiary.model.PageTemplate
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepo: SettingsRepository,
    private val authRepo: AuthRepository,
) : ViewModel() {

    val settings: StateFlow<AppSettings> = settingsRepo.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())

    val userEmail: String? get() = authRepo.currentUser?.email
    val userName: String? get() = authRepo.currentUser?.displayName

    fun setPenColor(hex: String) = viewModelScope.launch { settingsRepo.setPenColor(hex) }
    fun setPenWidth(dp: Float) = viewModelScope.launch { settingsRepo.setPenWidth(dp) }
    fun setPressureGamma(g: Float) = viewModelScope.launch { settingsRepo.setPressureGamma(g) }
    fun setFingerDrawing(enabled: Boolean) = viewModelScope.launch { settingsRepo.setFingerDrawing(enabled) }
    fun setTemplate(t: PageTemplate) = viewModelScope.launch { settingsRepo.setTemplate(t) }
    fun setDarkMode(m: DarkModeSetting) = viewModelScope.launch { settingsRepo.setDarkMode(m) }

    fun signOut(context: Context) = viewModelScope.launch { authRepo.signOut(context) }
}
