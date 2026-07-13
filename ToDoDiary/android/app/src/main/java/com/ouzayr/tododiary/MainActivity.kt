package com.ouzayr.tododiary

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.ouzayr.tododiary.ui.navigation.AppNavHost
import com.ouzayr.tododiary.ui.signin.SignInScreen
import com.ouzayr.tododiary.ui.theme.ToDoDiaryTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val settings by viewModel.settings.collectAsState()
            val user by viewModel.user.collectAsState()
            ToDoDiaryTheme(darkModeSetting = settings.darkMode) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    if (user == null) {
                        SignInScreen()
                    } else {
                        AppNavHost()
                    }
                }
            }
        }
    }
}
