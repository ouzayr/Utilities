package com.ouzayr.tododiary.ui.signin

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ouzayr.tododiary.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SignInUiState(
    val loading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class SignInViewModel @Inject constructor(
    private val authRepo: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(SignInUiState())
    val state: StateFlow<SignInUiState> = _state.asStateFlow()

    /** [activityContext] must be the Activity; Credential Manager needs it for its UI. */
    fun signIn(activityContext: Context, serverClientId: String) {
        _state.value = SignInUiState(loading = true)
        viewModelScope.launch {
            try {
                authRepo.signInWithGoogle(activityContext, serverClientId)
                _state.value = SignInUiState()
            } catch (e: Exception) {
                _state.value = SignInUiState(error = e.message ?: "Sign-in failed")
            }
        }
    }
}
