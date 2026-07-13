package com.ouzayr.tododiary

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseUser
import com.ouzayr.tododiary.auth.AuthRepository
import com.ouzayr.tododiary.data.AppSettings
import com.ouzayr.tododiary.data.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    authRepo: AuthRepository,
    settingsRepo: SettingsRepository,
) : ViewModel() {

    val user: StateFlow<FirebaseUser?> = authRepo.userFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, authRepo.currentUser)

    val settings: StateFlow<AppSettings> = settingsRepo.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())
}
