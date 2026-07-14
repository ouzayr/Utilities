package com.ouzayr.tododiary.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.ouzayr.tododiary.data.DarkModeSetting

// Paper-diary palette: warm paper, deep ink blue, brass accents.
val Paper = Color(0xFFFAF6EE)
val PaperDark = Color(0xFF14151F)
val InkBlue = Color(0xFF1A237E)
val Brass = Color(0xFFB8860B)
val RuleLine = Color(0x33556080)
val RuleLineDark = Color(0x336F7BA8)

private val LightColors = lightColorScheme(
    primary = InkBlue,
    onPrimary = Color.White,
    secondary = Brass,
    onSecondary = Color.White,
    background = Paper,
    onBackground = Color(0xFF20222E),
    surface = Color(0xFFFFFCF5),
    onSurface = Color(0xFF20222E),
    surfaceVariant = Color(0xFFF0EADC),
    onSurfaceVariant = Color(0xFF5A5D6E),
    outline = Color(0xFFB9B2A0),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9FA8DA),
    onPrimary = Color(0xFF10123A),
    secondary = Color(0xFFD4AF37),
    onSecondary = Color(0xFF2A2000),
    background = PaperDark,
    onBackground = Color(0xFFE4E2DA),
    surface = Color(0xFF1C1E2A),
    onSurface = Color(0xFFE4E2DA),
    surfaceVariant = Color(0xFF262838),
    onSurfaceVariant = Color(0xFFA9ACBD),
    outline = Color(0xFF4A4D5E),
)

@Composable
fun ToDoDiaryTheme(
    darkModeSetting: DarkModeSetting = DarkModeSetting.SYSTEM,
    content: @Composable () -> Unit,
) {
    val dark = when (darkModeSetting) {
        DarkModeSetting.SYSTEM -> isSystemInDarkTheme()
        DarkModeSetting.LIGHT -> false
        DarkModeSetting.DARK -> true
    }
    MaterialTheme(
        colorScheme = if (dark) DarkColors else LightColors,
        content = content,
    )
}
